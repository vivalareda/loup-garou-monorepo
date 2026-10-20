import { roomUrl } from '@repo/types';

/**
 * The game server's http(s) base URL. Set it to run against a separate
 * server (Vite dev against the Node server); leave it unset when the
 * Worker serves the dashboard, so it talks to its own origin.
 */
const backendUrl =
  import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL || window.location.origin;

/**
 * The game room's WebSocket URL, for the dashboard and its mock players.
 * VITE_PUBLIC_ACCESS_TOKEN is the Worker's optional shared token; it ends
 * up in the bundle, so it only keeps random scanners out.
 */
export const roomSocketUrl = roomUrl(
  backendUrl,
  import.meta.env.VITE_PUBLIC_ROOM_CODE || undefined,
  import.meta.env.VITE_PUBLIC_ACCESS_TOKEN || undefined
);
