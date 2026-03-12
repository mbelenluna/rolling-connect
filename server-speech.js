/**
 * Speech streaming server (Deepgram + Google Translate).
 * Runs on port 3001 to avoid conflicts with Next.js/Socket.IO.
 * Uses shared global.__speechTokenStore (must be set by caller).
 */
const { createServer } = require('http');
const { parse } = require('url');
const WebSocket = require('ws');

const { validate: validateSpeechToken } = require('./src/lib/speech-token-store');

function startSpeechServer() {
  const port = parseInt(process.env.SPEECH_WS_PORT || '3005', 10);
  const httpServer = createServer((req, res) => {
    const { pathname } = parse(req.url, true);
    if (pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('OK');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  httpServer.on('upgrade', (request, socket, head) => {
  const { pathname, query } = parse(request.url, true);
  console.log('[SpeechStream] Upgrade request:', pathname);

  if (pathname !== '/api/speech-stream') {
    socket.destroy();
    return;
  }

  const token = query.token;
  if (!token) {
    console.warn('[SpeechStream] Rejected: missing token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const auth = validateSpeechToken(token);
  if (!auth) {
    console.warn('[SpeechStream] Rejected: invalid token');
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const wss = new WebSocket.Server({ noServer: true });
  wss.handleUpgrade(request, socket, head, (clientWs) => {
    wss.emit('connection', clientWs, request);
  });

  wss.on('connection', (clientWs) => {
    console.log('[SpeechStream] Client connected');

    const deepgramKey = process.env.DEEPGRAM_API_KEY?.trim();
    const googleKey = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
    if (!deepgramKey || !googleKey) {
      console.error('[SpeechStream] Missing DEEPGRAM_API_KEY or GOOGLE_TRANSLATE_API_KEY');
      clientWs.send(JSON.stringify({ type: 'error', error: 'Speech services not configured' }));
      clientWs.close();
      return;
    }

    let sourceLang = 'en';
    let targetLang = 'es';
    let sourceLangDeepgram = 'en';
    let deepgramWs = null;
    const audioBuffer = [];

    const connectDeepgram = () => {
      const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&language=${sourceLangDeepgram}&model=nova-2&interim_results=true`;
      console.log('[SpeechStream] Connecting to Deepgram...');
      deepgramWs = new WebSocket(url, {
        headers: { Authorization: `Token ${deepgramKey}` },
      });

      deepgramWs.on('open', () => {
        console.log('[SpeechStream] Deepgram connected, flushing', audioBuffer.length, 'chunks');
        for (const buf of audioBuffer) deepgramWs.send(buf);
        audioBuffer.length = 0;
        clientWs.send(JSON.stringify({ type: 'ready' }));
      });

      deepgramWs.on('message', async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          const transcript = msg?.channel?.alternatives?.[0]?.transcript?.trim();
          if (!transcript) return;

          const isFinal = msg?.is_final === true;
          console.log('[SpeechStream] Transcript:', isFinal ? 'FINAL' : 'interim', transcript.substring(0, 50));

          let text = transcript;
          try {
            const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}&q=${encodeURIComponent(transcript)}&source=${sourceLang}&target=${targetLang}`;
            const res = await fetch(translateUrl);
            const json = await res.json();
            if (!res.ok) {
              console.error('[SpeechStream] Google Translate error:', res.status, json?.error?.message || JSON.stringify(json).substring(0, 100));
            } else {
              text = json?.data?.translations?.[0]?.translatedText ?? transcript;
            }
          } catch (err) {
            console.error('[SpeechStream] Translate error:', err.message);
          }

          const payload = { type: isFinal ? 'final' : 'interim', text };
          clientWs.send(JSON.stringify(payload));
        } catch (err) {
          console.error('[SpeechStream] Parse error:', err.message);
        }
      });

      deepgramWs.on('error', (err) => {
        console.error('[SpeechStream] Deepgram error:', err.message);
        clientWs.send(JSON.stringify({ type: 'error', error: String(err.message) }));
      });

      deepgramWs.on('close', () => {
        deepgramWs = null;
      });
    };

    clientWs.on('message', (data) => {
      const str = (typeof data === 'string' || Buffer.isBuffer(data)) ? String(data) : '';
      if (str.startsWith('{')) {
        try {
          const cfg = JSON.parse(str);
          if (cfg.sourceLang) sourceLang = cfg.sourceLang;
          if (cfg.targetLang) targetLang = cfg.targetLang;
          if (cfg.sourceLangDeepgram) sourceLangDeepgram = cfg.sourceLangDeepgram;
          console.log('[SpeechStream] Config:', { sourceLang, targetLang, sourceLangDeepgram });
          connectDeepgram();
        } catch (e) {
          console.error('[SpeechStream] Config parse error:', e);
        }
        return;
      }

      if (data && typeof data !== 'string') {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (audioBuffer.length === 0 && (!deepgramWs || deepgramWs.readyState !== WebSocket.OPEN)) {
          console.log('[SpeechStream] First audio chunk,', buf.length, 'bytes');
        }
        if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
          deepgramWs.send(buf);
        } else {
          audioBuffer.push(buf);
        }
      }
    });

    clientWs.on('close', () => {
      if (deepgramWs) deepgramWs.close();
    });
  });
  });

  httpServer.listen(port, () => {
    console.log(`[SpeechStream] Server running on ws://localhost:${port}`);
    console.log(`[SpeechStream] Health check: http://localhost:${port}/health`);
  });
}

// Allow standalone run: node server-speech.js
if (require.main === module) {
  require('dotenv').config();
  global.__speechTokenStore = global.__speechTokenStore || new Map();
  startSpeechServer();
}

module.exports = { startSpeechServer };
