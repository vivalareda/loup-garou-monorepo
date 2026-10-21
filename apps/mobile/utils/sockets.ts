import { createRealtimeClient } from '@repo/realtime';
import { roomUrl } from '@repo/types';

if (!process.env.EXPO_PUBLIC_BACKEND_SERVER_URL) {
  throw new Error('Missing EXPO_PUBLIC_BACKEND_SERVER_URL env variable');
}

// The http(s) base URL of the game server; the socket connects to the
// ws(s) room endpoint derived from it
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_SERVER_URL;

// The Worker's optional shared token: compiled into the app, so it only
// keeps random scanners out, it is not authentication
const url = roomUrl(
  backendUrl,
  process.env.EXPO_PUBLIC_ROOM_CODE || undefined,
  process.env.EXPO_PUBLIC_ACCESS_TOKEN || undefined
);

console.log('🔗 Connecting to:', url.split('?')[0]);

// Reconnects on its own after a drop (locked phone, app in background,
// network hop) and fires `connect` again: session-recovery.ts rejoins
// with the session token from there. Taps made while reconnecting are
// dropped, not replayed: the rejoin snapshot reopens any pending prompt.
// Before the very first connection only two emits are queued: a join
// tapped while the app is still connecting, and the roster read the game
// layout sends on mount. Neither can go stale; game actions never are
export const socket = createRealtimeClient(url, {
  bufferBeforeConnect: ['player:join', 'lobby:get-players-list'],
});

socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});
