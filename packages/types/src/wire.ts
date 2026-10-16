/**
 * The realtime wire protocol: every message is one JSON text frame over a
 * plain WebSocket.
 *
 * - server → client `{ event, args }`: an event (`ServerToClientEvents`)
 * - client → server `{ event, args, ack? }`: an event
 *   (`ClientToServerEvents`); `ack` asks the server for a reply
 * - server → client `{ ack, args }`: the reply to the client's `ack`, whose
 *   `args` are what the server passed to the handler's reply callback
 *
 * Event names are checked against the event maps (`isClientEvent` /
 * `isServerEvent`); argument shapes are not, so handlers keep validating
 * their own payloads.
 */
export type EventFrame = { event: string; args: unknown[] };
export type ClientFrame = EventFrame & { ack?: number };
export type AckFrame = { ack: number; args: unknown[] };
export type ServerFrame = EventFrame | AckFrame;

export function encodeFrame(frame: ClientFrame | ServerFrame): string {
  return JSON.stringify(frame);
}

function parseObject(data: unknown): Record<string, unknown> | null {
  if (typeof data !== 'string') {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function isAckId(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** A frame a client sent, or null when it is malformed. */
export function parseClientFrame(data: unknown): ClientFrame | null {
  const frame = parseObject(data);
  if (!frame || typeof frame.event !== 'string' || !Array.isArray(frame.args)) {
    return null;
  }
  if (frame.ack === undefined) {
    return { event: frame.event, args: frame.args };
  }
  return isAckId(frame.ack)
    ? { event: frame.event, args: frame.args, ack: frame.ack }
    : null;
}

/** A frame the server sent, or null when it is malformed. */
export function parseServerFrame(data: unknown): ServerFrame | null {
  const frame = parseObject(data);
  if (!(frame && Array.isArray(frame.args))) {
    return null;
  }
  if (typeof frame.event === 'string') {
    return { event: frame.event, args: frame.args };
  }
  if (isAckId(frame.ack)) {
    return { ack: frame.ack, args: frame.args };
  }
  return null;
}

/** The room clients join when no code is configured. */
export const DEFAULT_ROOM_CODE = 'default';

const ROOM_CODE = /^[A-Za-z0-9_-]{1,64}$/;
const ROOM_PATH = /^\/room\/([^/]+)\/?$/;
const HTTP_SCHEME = /^http(s?):\/\//i;
const TRAILING_SLASHES = /\/+$/;

export function isRoomCode(code: string): boolean {
  return ROOM_CODE.test(code);
}

/** The room code in a `/room/<code>` path, or null for any other path. */
export function parseRoomPath(pathname: string): string | null {
  const code = ROOM_PATH.exec(pathname)?.[1];
  return code !== undefined && isRoomCode(code) ? code : null;
}

/**
 * The WebSocket URL of a room, from the server's http(s) base URL (the
 * form the apps' env vars hold): `http://host:3000` → `ws://host:3000/room/<code>`.
 * String-based on purpose: React Native's `URL` is incomplete.
 */
export function roomUrl(baseUrl: string, roomCode = DEFAULT_ROOM_CODE): string {
  if (!isRoomCode(roomCode)) {
    throw new Error(
      `Invalid room code "${roomCode}": use 1-64 letters, digits, - or _`
    );
  }
  const base = baseUrl
    .trim()
    .replace(HTTP_SCHEME, 'ws$1://')
    .replace(TRAILING_SLASHES, '');
  return `${base}/room/${roomCode}`;
}
