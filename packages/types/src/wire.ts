/**
 * The realtime wire protocol: every message is one JSON text frame over a
 * plain WebSocket.
 *
 * - server → client `{ event, args }`: an event (`ServerToClientEvents`)
 * - client → server `{ event, args, ack? }`: an event
 *   (`ClientToServerEvents`); `ack` asks the server for a reply
 * - server → client `{ ack, args }`: the reply to the client's `ack`, whose
 *   `args` are what the server passed to the handler's reply callback
 * - client → server `{ ping: n }`, answered by server → client `{ pong: n }`:
 *   the application-level heartbeat. Browsers and React Native cannot send
 *   protocol pings and a Durable Object cannot either, so liveness is
 *   checked with these frames on both ends. They carry no `event`, so they
 *   can never be mistaken for (or collide with) a game event.
 *
 * Event names are checked against the event maps (`isClientEvent` /
 * `isServerEvent`); argument shapes are not, so handlers keep validating
 * their own payloads.
 */
import {
  type ClientToServerEvents,
  isClientEvent,
  isServerEvent,
  type ServerToClientEvents,
} from './event';

export type EventFrame = {
  event: keyof ServerToClientEvents;
  args: unknown[];
};

export type ClientEventFrame = {
  event: keyof ClientToServerEvents;
  args: unknown[];
  ack?: number;
};

export type AckFrame = { ack: number; args: unknown[] };

export type PingFrame = { ping: number };

export type PongFrame = { pong: number };

export type ClientFrame = ClientEventFrame | PingFrame;

export type ServerFrame = EventFrame | AckFrame | PongFrame;

export function encodeFrame(frame: ClientFrame | ServerFrame): string {
  return JSON.stringify(frame);
}

/**
 * What a WebSocket `message` event carries: a text frame's string, or a
 * binary frame's bytes (an `ArrayBuffer`, or Node's `Buffer`; a browser
 * may also hand over a `Blob`, rejected like any binary frame). The
 * protocol only uses text frames.
 */
export type FrameData = string | ArrayBuffer | ArrayBufferView;

/** A decoded JSON object before validation: any field may be missing or wrong. */
type RawFrame = {
  event?: unknown;
  args?: unknown;
  ack?: unknown;
  ping?: unknown;
  pong?: unknown;
};

/** JSON.parse builds objects (and arrays) from this realm's `Object`. */
function isRawFrame(value: unknown): value is RawFrame {
  return value instanceof Object && !Array.isArray(value);
}

function decodeFrame(data: FrameData): RawFrame | null {
  // A binary frame is not part of the text protocol
  if (data instanceof Object) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }

  return isRawFrame(value) ? value : null;
}

/** Ack ids and ping sequence numbers: non-negative safe integers. */
function isFrameId(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

/**
 * A frame a client sent, or null when it is malformed or names an event
 * that is not in `ClientToServerEvents`.
 */
export function parseClientFrame(data: FrameData): ClientFrame | null {
  const frame = decodeFrame(data);

  if (frame && frame.event === undefined && isFrameId(frame.ping)) {
    return { ping: frame.ping };
  }

  if (!(frame && isClientEvent(frame.event) && Array.isArray(frame.args))) {
    return null;
  }

  if (frame.ack === undefined) {
    return { event: frame.event, args: frame.args };
  }

  return isFrameId(frame.ack)
    ? { event: frame.event, args: frame.args, ack: frame.ack }
    : null;
}

/**
 * A frame the server sent, or null when it is malformed or names an event
 * that is not in `ServerToClientEvents` (say, from a newer server).
 */
export function parseServerFrame(data: FrameData): ServerFrame | null {
  const frame = decodeFrame(data);

  if (frame && frame.event === undefined && isFrameId(frame.pong)) {
    return { pong: frame.pong };
  }

  if (!(frame && Array.isArray(frame.args))) {
    return null;
  }

  if (isServerEvent(frame.event)) {
    return { event: frame.event, args: frame.args };
  }

  if (frame.event === undefined && isFrameId(frame.ack)) {
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
 * An `accessToken` (the Worker's optional shared token) is appended as
 * `?token=`. String-based on purpose: React Native's `URL` is incomplete.
 */
export function roomUrl(
  baseUrl: string,
  roomCode = DEFAULT_ROOM_CODE,
  accessToken?: string
): string {
  if (!isRoomCode(roomCode)) {
    throw new Error(
      `Invalid room code "${roomCode}": use 1-64 letters, digits, - or _`
    );
  }

  const base = baseUrl
    .trim()
    .replace(HTTP_SCHEME, 'ws$1://')
    .replace(TRAILING_SLASHES, '');

  const query = accessToken ? `?token=${encodeURIComponent(accessToken)}` : '';

  return `${base}/room/${roomCode}${query}`;
}
