import { createRealtimeClient } from '@repo/realtime';
import { type DeathInfo, roomUrl } from '@repo/types';

if (!import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL) {
  throw new Error('Missing VITE_PUBLIC_BACKEND_SERVER_URL env variable');
}

/** The game room's WebSocket URL, from the server's http(s) base URL. */
export const roomSocketUrl = roomUrl(
  import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL,
  import.meta.env.VITE_PUBLIC_ROOM_CODE || undefined
);

export const socket = createRealtimeClient(roomSocketUrl);

// Game events state - simple global store for demo
export const gameEvents: { deaths: DeathInfo[]; logs: string[] } = {
  deaths: [],
  logs: [],
};

socket.on('connect', () => {
  console.log('Socket connected');
  gameEvents.logs.push('🟢 Connected to server');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
  gameEvents.logs.push(`🔴 Connection error: ${error.message}`);
});

// Death and Day phase event listeners
socket.on('night:deaths-announced', (deaths: DeathInfo[]) => {
  console.log('💀 Night deaths:', deaths);
  gameEvents.deaths = deaths;
  gameEvents.logs.push(`💀 ${deaths.length} player(s) died during the night`);
  for (const death of deaths) {
    gameEvents.logs.push(`  💀 ${death.playerName} died from ${death.cause}`);
  }
});

socket.on('day:voting-phase-start', () => {
  console.log('🌅 Day voting phase started');
  gameEvents.logs.push('🌅 Day voting phase started');
});
