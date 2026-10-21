import { createRoom } from '@repo/realtime';
import {
  DEFAULT_ROOM_CODE,
  isRoomCode,
  normalizeRoomCode,
  roomUrl,
} from '@repo/types';

/**
 * The game server's http(s) base URL. Set it to run against a separate
 * server (Vite dev against the Node server); leave it unset when the
 * Worker serves the dashboard, so it talks to its own origin.
 */
const backendUrl =
  import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL || window.location.origin;

/**
 * VITE_PUBLIC_ACCESS_TOKEN is the Worker's optional shared token; it ends
 * up in the bundle, so it only keeps random scanners out.
 */
const accessToken = import.meta.env.VITE_PUBLIC_ACCESS_TOKEN || undefined;

/**
 * The room this tab narrates and drives: `?room=<code>` in the page URL,
 * else the build-time VITE_PUBLIC_ROOM_CODE, else "default" (the Node
 * server's single game; on the Worker a room must be created first).
 */
function resolveRoomCode() {
  const requested = new URLSearchParams(window.location.search).get('room');

  if (requested !== null) {
    const code = normalizeRoomCode(requested);

    if (isRoomCode(code)) {
      return code;
    }

    console.warn(`Ignoring the invalid ?room=${requested}`);
  }

  return import.meta.env.VITE_PUBLIC_ROOM_CODE || DEFAULT_ROOM_CODE;
}

export const roomCode = resolveRoomCode();

/** The room's WebSocket URL, for the dashboard and its mock players. */
export const roomSocketUrl = roomUrl(backendUrl, roomCode, accessToken);

/**
 * Reloads the dashboard on room `code`: the socket, the mock players and
 * the narrator all belong to one room, so switching starts the tab over.
 */
export function openRoom(code: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('room', normalizeRoomCode(code));
  window.location.assign(url);
}

/** Creates a private room and opens it in this tab. */
export async function createAndOpenRoom() {
  openRoom(await createRoom(backendUrl, { accessToken }));
}
