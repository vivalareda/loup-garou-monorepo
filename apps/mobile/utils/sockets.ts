import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

if (!process.env.EXPO_PUBLIC_BACKEND_SERVER_URL) {
  throw new Error('Missing EXPO_PUBLIC_BACKEND_SERVER_URL env variable');
}

const backendUrl = process.env.EXPO_PUBLIC_BACKEND_SERVER_URL;
// export let isConnected = false;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  backendUrl,
  {
    autoConnect: true,
    transports: ['websocket'],
  }
);

socket.on('connect', () => {
  console.log('Socket connected');
  // isConnected = true;
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});
