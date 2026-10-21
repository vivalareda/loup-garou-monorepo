import { createRealtimeClient } from '@repo/realtime';
import type { DeathInfo } from '@repo/types';
import { roomSocketUrl } from './room-url';

// Nothing is buffered before the first connection: the controls send
// admin commands, which must never fire late on a game that moved on
export const socket = createRealtimeClient(roomSocketUrl);

socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});

// Death and Day phase event listeners
socket.on('night:deaths-announced', (deaths: DeathInfo[]) => {
  console.log('💀 Night deaths:', deaths);
});

socket.on('day:voting-phase-start', () => {
  console.log('🌅 Day voting phase started');
});
