import { Server as NetServer } from 'http';
import { Server } from 'socket.io';

let io: Server | null = null;

export function initSocketServer(httpServer: NetServer) {
  if (io) return io;
  io = new Server(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    socket.on('auth', (data: { userId: string; role: string }) => {
      socket.data.userId = data.userId;
      socket.data.role = data.role;
      socket.join(`user:${data.userId}`);
      if (data.role === 'interpreter') socket.join('interpreters');
    });
  });

  return io;
}

export function getSocketServer(): Server | null {
  return io;
}

export function emitToInterpreter(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

export function emitToInterpreters(event: string, payload: unknown) {
  io?.to('interpreters').emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}
