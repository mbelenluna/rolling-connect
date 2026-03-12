require('dotenv').config();
// Shared token store - must be set before any module loads speech-token-store
global.__speechTokenStore = new Map();
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const { setupSpeechWebSocket } = require('./server-speech');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  setupSpeechWebSocket(httpServer);

  const io = new Server(httpServer, {
    path: '/api/socketio',
    addTrailingSlash: false,
  });

  const interpreterSockets = new Map();

  io.on('connection', (socket) => {
    socket.on('auth', (data) => {
      if (data?.userId) {
        socket.data.userId = data.userId;
        socket.data.role = data.role;
        socket.join(`user:${data.userId}`);
        if (data.role === 'interpreter') {
          socket.join('interpreters');
          interpreterSockets.set(data.userId, socket.id);
        }
        // Clients also join user room for request_status events
      }
    });

    socket.on('disconnect', () => {
      if (socket.data?.userId && socket.data?.role === 'interpreter') {
        interpreterSockets.delete(socket.data.userId);
      }
    });
  });

  global.io = io;
  global.interpreterSockets = interpreterSockets;

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Speech WebSocket ready on /api/speech-stream`);
    });
});
