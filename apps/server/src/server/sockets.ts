import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Server } from 'socket.io';
import { httpServer } from './http-server';

export type SocketType = typeof io;

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
    credentials: true,
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

export { io };
