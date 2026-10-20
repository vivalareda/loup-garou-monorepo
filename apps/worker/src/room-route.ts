import { isRoomCode } from '@repo/types';

const ROOM_PREFIX = '/room/';
const TRAILING_SLASH = /\/$/;

export type RoomRoute =
  | { kind: 'room'; code: string }
  | { kind: 'bad-code' }
  | { kind: 'other' };

/**
 * Classifies a request path. `/room/<code>` is a game room, keyed by the
 * upper-cased code so `abcd` and `ABCD` are the same room. The code rules
 * are the clients' own (`isRoomCode`, what `roomUrl` accepts), so every
 * URL a client builds reaches a room.
 */
export function routeRoom(pathname: string): RoomRoute {
  if (!pathname.startsWith(ROOM_PREFIX)) {
    return { kind: 'other' };
  }
  const code = pathname.slice(ROOM_PREFIX.length).replace(TRAILING_SLASH, '');
  if (!isRoomCode(code)) {
    return { kind: 'bad-code' };
  }
  return { kind: 'room', code: code.toUpperCase() };
}

/** True for a WebSocket upgrade request. */
export function isWebSocketUpgrade(request: Request) {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

/** 426 for a plain request where only a WebSocket upgrade is served. */
export function upgradeRequired() {
  return new Response('Expected a WebSocket upgrade', {
    status: 426,
    headers: { Upgrade: 'websocket' },
  });
}
