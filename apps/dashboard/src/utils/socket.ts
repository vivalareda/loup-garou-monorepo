import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

if (!import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL) {
  throw new Error('Missing VITE_PUBLIC_BACKEND_SERVER_URL env variable');
}

const backendUrl = import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  backendUrl,
  {
    autoConnect: true,
    transports: ['websocket'],
  }
);

socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});
