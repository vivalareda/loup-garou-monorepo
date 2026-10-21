import {
  createRealtimeClient,
  createRoom as createRoomAt,
  roomExists as roomExistsAt,
} from '@repo/realtime';
import { roomUrl } from '@repo/types';

if (!process.env.EXPO_PUBLIC_BACKEND_SERVER_URL) {
  throw new Error('Missing EXPO_PUBLIC_BACKEND_SERVER_URL env variable');
}

// The http(s) base URL of the game server: the room API lives there, and
// each room's socket connects to the ws(s) endpoint derived from it
const backendUrl = process.env.EXPO_PUBLIC_BACKEND_SERVER_URL;

// The Worker's optional shared token: compiled into the app, so it only
// keeps random scanners out, it is not authentication
const accessToken = process.env.EXPO_PUBLIC_ACCESS_TOKEN || undefined;

// Not connected until the player enters a room (connectToRoom).
// Reconnects on its own after a drop (locked phone, app in background,
// network hop) and fires `connect` again: session-recovery.ts rejoins
// with the session token from there. Taps made while reconnecting are
// dropped, not replayed: the rejoin snapshot reopens any pending prompt.
// Before a room's very first connection only two emits are queued: a join
// tapped while the app is still connecting, and the roster read the game
// layout sends on mount. Neither can go stale; game actions never are
export const socket = createRealtimeClient(null, {
  bufferBeforeConnect: ['player:join', 'lobby:get-players-list'],
});

/** Points the socket at room `code`, leaving any other room. */
export function connectToRoom(code: string) {
  const url = roomUrl(backendUrl, code, accessToken);
  console.log('🔗 Connecting to:', url.split('?')[0]);
  socket.connect(url);
}

/** Creates a private room on the server; resolves to its code. */
export function createRoom() {
  return createRoomAt(backendUrl, { accessToken });
}

/** Whether room `code` exists on the server (false for a wrong code). */
export function roomExists(code: string) {
  return roomExistsAt(backendUrl, code, { accessToken });
}

socket.on('connect', () => {
  console.log('Socket connected');
});

socket.on('connect_error', (error) => {
  console.log('Socket connection error:', error);
});
