/**
 * Speech streaming handler (Deepgram + Google Translate).
 * Attaches a /api/speech-stream WebSocket handler to an existing HTTP server.
 * Uses shared global.__speechTokenStore (must be set by caller before this module loads).
 */
const { createServer } = require('http');
const { parse } = require('url');
const WebSocket = require('ws');

const { validate: validateSpeechToken } = require('./src/lib/speech-token-store');

/**
 * Attach the /api/speech-stream WebSocket handler to the given httpServer.
 * Call this once after the HTTP server is created, before it starts listening.
 */
function setupSpeechWebSocket(httpServer) {
  // Single WSS instance shared across all connections
  const wss = new WebSocket.Server({ noServer: true });

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
    let deepgramConnecting = false;
    let reconnecting = false;
    let deepgramConnectionCount = 0; // track reconnects to discard stale buffer
    const MAX_BUFFER_CHUNKS = 50; // ~4s of audio max — prevents unbounded memory growth
    const audioBuffer = [];

    // Keepalive ping every 30s to prevent Railway/proxy idle timeout
    const keepAliveInterval = setInterval(() => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.ping();
      }
    }, 30000);

    const connectDeepgram = () => {
      if (deepgramConnecting || deepgramWs) return; // Prevent multiple concurrent connections
      deepgramConnecting = true;
      const url = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&language=${sourceLangDeepgram}&model=nova-2&interim_results=true&endpointing=300&smart_format=true`;
      console.log('[SpeechStream] Connecting to Deepgram...');
      deepgramWs = new WebSocket(url, {
        headers: { Authorization: `Token ${deepgramKey}` },
      });

      deepgramWs.on('open', () => {
        deepgramConnecting = false;
        deepgramConnectionCount++;
        if (deepgramConnectionCount === 1) {
          // First connection: flush pre-buffered audio (arrived before Deepgram was ready)
          console.log('[SpeechStream] Deepgram connected, flushing', audioBuffer.length, 'buffered chunks');
          for (const buf of audioBuffer) deepgramWs.send(buf);
          clientWs.send(JSON.stringify({ type: 'ready' }));
        } else {
          // Reconnect: discard stale buffer — sending a burst of old audio garbles transcripts
          console.log('[SpeechStream] Deepgram reconnected (#' + deepgramConnectionCount + '), discarding', audioBuffer.length, 'stale chunks');
        }
        audioBuffer.length = 0;
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
            const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${googleKey}&q=${encodeURIComponent(transcript)}&source=${sourceLang}&target=${targetLang}&format=text`;
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
          if (clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(payload));
        } catch (err) {
          console.error('[SpeechStream] Parse error:', err.message);
        }
      });

      deepgramWs.on('error', (err) => {
        deepgramConnecting = false;
        console.error('[SpeechStream] Deepgram error:', err.message);
        if (clientWs.readyState === WebSocket.OPEN)
          clientWs.send(JSON.stringify({ type: 'error', error: String(err.message) }));
      });

      deepgramWs.on('close', () => {
        deepgramConnecting = false;
        console.log('[SpeechStream] Deepgram connection closed');
        deepgramWs = null;
        // Auto-reconnect if client is still connected
        if (clientWs.readyState === WebSocket.OPEN && !reconnecting) {
          reconnecting = true;
          console.log('[SpeechStream] Reconnecting to Deepgram in 1s...');
          setTimeout(() => {
            reconnecting = false;
            if (clientWs.readyState === WebSocket.OPEN) connectDeepgram();
          }, 1000);
        }
      });
    };

    clientWs.on('message', (data, isBinary) => {
      if (!isBinary) {
        // Text frame: JSON config sent before audio
        const str = typeof data === 'string' ? data : data.toString('utf8');
        try {
          const cfg = JSON.parse(str);
          if (cfg.sourceLang) sourceLang = cfg.sourceLang;
          if (cfg.targetLang) targetLang = cfg.targetLang;
          if (cfg.sourceLangDeepgram) sourceLangDeepgram = cfg.sourceLangDeepgram;
          console.log('[SpeechStream] Config received:', { sourceLang, targetLang, sourceLangDeepgram });
          connectDeepgram();
        } catch (e) {
          console.error('[SpeechStream] Config parse error:', e);
        }
        return;
      }

      // Binary frame: raw PCM audio — forward to Deepgram
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (deepgramWs && deepgramWs.readyState === WebSocket.OPEN) {
        deepgramWs.send(buf);
      } else if (audioBuffer.length < MAX_BUFFER_CHUNKS) {
        audioBuffer.push(buf);
      }
      // else: drop chunk — prevents unbounded memory growth during reconnect
    });

    clientWs.on('close', () => {
      console.log('[SpeechStream] Client disconnected');
      clearInterval(keepAliveInterval);
      reconnecting = true; // prevent any pending reconnect from firing
      if (deepgramWs) {
        deepgramWs.close();
        deepgramWs = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[SpeechStream] Client WS error:', err.message);
    });
  });

  httpServer.on('upgrade', (request, socket, head) => {
    try {
      const { pathname, query } = parse(request.url, true);

      // Only handle speech stream upgrades — let Socket.IO handle the rest
      if (pathname !== '/api/speech-stream') {
        return;
      }

      console.log('[SpeechStream] Upgrade request for /api/speech-stream');

      const token = query.token;
      if (!token) {
        console.log('[SpeechStream] Rejected: missing token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      let auth;
      try {
        auth = validateSpeechToken(token);
      } catch (e) {
        console.error('[SpeechStream] validateSpeechToken threw:', e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
        return;
      }

      if (!auth) {
        console.log('[SpeechStream] Rejected: invalid/expired token');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      // Hand off to the shared WSS instance
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error('[SpeechStream] Uncaught error in upgrade handler:', err);
      try { socket.destroy(); } catch {}
    }
  });
}

// Allow standalone run: node server-speech.js
// Railway injects PORT; SPEECH_WS_PORT is a fallback for local testing.
if (require.main === module) {
  require('dotenv').config();
  const port = parseInt(process.env.PORT || process.env.SPEECH_WS_PORT || '3000', 10);
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
  setupSpeechWebSocket(httpServer);
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`[SpeechStream] Standalone server running on port ${port}`);
  });
}

module.exports = { setupSpeechWebSocket };
