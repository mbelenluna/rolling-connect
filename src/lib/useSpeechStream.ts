/**
 * Hook for Deepgram + Google Translation speech streaming.
 * Replaces Azure Speech SDK.
 */
import { toDeepgramLanguage, toGoogleLanguage } from './speech-languages';

export type SpeechStreamCallbacks = {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onReady: () => void;
  onError: (err: string) => void;
  onClose: () => void;
};

export type SpeechStreamController = {
  close: () => void;
};

const SAMPLE_RATE = 16000;
const TARGET_SAMPLE_RATE = 16000;

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, buffer.length - 1);
    const t = srcIndex - srcIndexFloor;
    result[i] = buffer[srcIndexFloor] * (1 - t) + buffer[srcIndexCeil] * t;
  }
  return result;
}

export async function startSpeechStream(
  tokenUrl: string,
  sourceLang: string,
  targetLang: string,
  callbacks: SpeechStreamCallbacks
): Promise<SpeechStreamController | null> {
  console.log('[SpeechStream] startSpeechStream called, tokenUrl=', tokenUrl);
  const tokenRes = await fetch(tokenUrl, { credentials: 'include' });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) {
    if (typeof window !== 'undefined') console.error('[SpeechStream] Token fetch failed:', tokenRes.status, tokenData);
    throw new Error(tokenData.error || 'Failed to get speech token');
  }

  const { token } = tokenData;
  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Use dedicated speech server port when set (avoids Next.js/Socket.IO conflicts)
  const speechPort = typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SPEECH_WS_PORT;
  const host = speechPort
    ? `${window.location.hostname}:${speechPort}`
    : (typeof window !== 'undefined' ? window.location.host : 'localhost:3000');
  const wsUrl = `${protocol}//${host}/api/speech-stream?token=${token}`;
  console.log('[SpeechStream] Connecting to', wsUrl.replace(/token=[^&]+/, 'token=***'));
  const ws = new WebSocket(wsUrl);

  let audioContext: AudioContext | null = null;
  let audioNodes: { disconnect?: () => void }[] = [];
  let stream: MediaStream | null = null;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    try { ws.close(); } catch {}
    try {
      audioNodes.forEach((n) => { try { n?.disconnect?.(); } catch {} });
      stream?.getTracks().forEach((t) => t.stop());
    } catch {}
    const ctx = audioContext;
    audioContext = null;
    if (ctx && ctx.state !== 'closed') {
      ctx.close().catch(() => {});
    }
  };

  ws.onerror = () => {
    console.error('[SpeechStream] WebSocket error - is the custom server (node server.js) running?');
    callbacks.onError('WebSocket error');
    close();
  };

  ws.onclose = () => {
    console.log('[SpeechStream] WebSocket closed');
    callbacks.onClose();
    close();
  };

  ws.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'error') {
        if (typeof window !== 'undefined') console.error('[SpeechStream] Server error:', msg.error);
        callbacks.onError(msg.error || 'Unknown error');
        return;
      }
      if (msg.type === 'ready') {
        console.log('[SpeechStream] Ready received from server');
        callbacks.onReady();
        return;
      }
      if (msg.type === 'interim' && msg.text) {
        console.log('[SpeechStream] Received interim:', msg.text.substring(0, 40));
        callbacks.onInterim(msg.text);
        return;
      }
      if (msg.type === 'final' && msg.text) {
        console.log('[SpeechStream] Received final:', msg.text.substring(0, 40));
        callbacks.onFinal(msg.text);
      }
    } catch {}
  };

  ws.onopen = async () => {
    console.log('[SpeechStream] WebSocket connected');
    try {
      const dgSource = toDeepgramLanguage(sourceLang);
      const googleSource = toGoogleLanguage(sourceLang);
      const googleTarget = toGoogleLanguage(targetLang);
      const config = { sourceLang: googleSource, targetLang: googleTarget, sourceLangDeepgram: dgSource };
      ws.send(JSON.stringify(config));
      console.log('[SpeechStream] Config sent, getting microphone...');

      // Advance UI immediately so we don't stay stuck on "Starting..." while waiting for mic
      callbacks.onReady();

      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      console.log('[SpeechStream] Microphone acquired, creating AudioContext...');

      audioContext = new AudioContext();
      const inputRate = audioContext.sampleRate;
      console.log('[SpeechStream] AudioContext created, sampleRate=', inputRate, 'state=', audioContext.state);

      // Resume if suspended (browsers often start AudioContext suspended until user interaction)
      if (audioContext.state === 'suspended') {
        console.log('[SpeechStream] AudioContext suspended, calling resume()...');
        await audioContext.resume();
        console.log('[SpeechStream] AudioContext resumed, state=', audioContext.state);
      }

      const src = audioContext.createMediaStreamSource(stream);
      const proc = audioContext.createScriptProcessor(4096, 1, 1);
      audioNodes = [src, proc];
      let chunkCount = 0;
      let firstChunkLogged = false;
      proc.onaudioprocess = (e) => {
        if (!firstChunkLogged) {
          firstChunkLogged = true;
          console.log('[SpeechStream] First audio chunk - mic is flowing');
        }
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = e.inputBuffer.getChannelData(0);
        const resampled = inputRate !== TARGET_SAMPLE_RATE
          ? downsample(input, inputRate, TARGET_SAMPLE_RATE)
          : input;
        ws.send(floatTo16BitPCM(resampled));
        chunkCount++;
        if (chunkCount === 50) console.log('[SpeechStream] Sent 50 audio chunks to server');
      };
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      src.connect(proc);
      proc.connect(gain);
      gain.connect(audioContext.destination);
    } catch (err) {
      if (typeof window !== 'undefined') console.error('[SpeechStream] Setup error:', err);
      callbacks.onError(err instanceof Error ? err.message : 'Failed to start microphone');
      close();
    }
  };

  return { close };
}
