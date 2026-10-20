import {
  type ClientToServerEvents,
  encodeFrame,
  isClientEvent,
  parseClientFrame,
  type ServerToClientEvents,
} from '@repo/types';
import type { Connection, ConnectionHost } from '@/server/connection';

/**
 * The slice of a WebSocket the host uses, met structurally by both the
 * `ws` package's WebSocket (Node) and the Workers runtime's WebSocket (a
 * Durable Object), so this file imports nothing Node-only.
 */
export type WebSocketLike = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void
  ): void;
  addEventListener(type: 'close' | 'error', listener: () => void): void;
};

/** `WebSocket.OPEN`, without depending on a global `WebSocket`. */
const OPEN = 1;
/** Close codes: frame too large (RFC 6455), and silent client (private). */
const MESSAGE_TOO_BIG = 1009;
const IDLE_TIMEOUT = 4000;

/**
 * Clients ping every ~20s (@repo/realtime), so 45s of silence means the
 * client is gone even if its socket never reported `close` (dead phone,
 * broken network) or it missed one ping.
 */
export const DEFAULT_IDLE_TIMEOUT_MS = 45_000;
/** The biggest game frame (a full snapshot) is a few KiB. */
export const DEFAULT_MAX_FRAME_BYTES = 64 * 1024;

/** The timers the host uses; injectable for tests. */
export type HostTimers = {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const globalTimers: HostTimers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) =>
    clearTimeout(handle as ReturnType<typeof setTimeout>),
};

const utf8 = new TextEncoder();

/** UTF-8 size of a text frame, encoding only when the length is ambiguous. */
function exceedsBytes(text: string, maxBytes: number) {
  if (text.length > maxBytes) {
    return true;
  }
  return text.length * 3 > maxBytes && utf8.encode(text).length > maxBytes;
}

type ServerEvent = keyof ServerToClientEvents;
type Listener = (...args: unknown[]) => void;

export type WebSocketHostOptions = {
  /** Connection ids; must never repeat. Defaults to `crypto.randomUUID`. */
  createId?: () => string;
  /**
   * A connection that sends nothing (not even a heartbeat ping) for this
   * long is closed and disconnected. 0 disables it.
   */
  idleTimeoutMs?: number;
  /**
   * Larger text frames close the connection (code 1009, as `ws` does for
   * its `maxPayload`) before any parsing.
   */
  maxFrameBytes?: number;
  timers?: HostTimers;
};

/**
 * A `ConnectionHost` over raw WebSockets speaking the JSON frames of
 * `@repo/types` wire.ts. The transport owner (the Node `ws` server, or a
 * Durable Object) upgrades the request and hands each socket to `accept`;
 * everything else (dispatch, ack replies, heartbeat pongs, idle and
 * frame-size limits, broadcasts, the single `disconnect`) happens here,
 * per the contract in connection.ts.
 */
export class WebSocketHost implements ConnectionHost {
  private readonly connections = new Map<string, WebSocketConnection>();
  private readonly connectionListeners: ((connection: Connection) => void)[] =
    [];
  private readonly createId: () => string;
  readonly idleTimeoutMs: number;
  readonly maxFrameBytes: number;
  /** @internal */
  readonly timers: HostTimers;

  constructor(options: WebSocketHostOptions = {}) {
    this.createId = options.createId ?? (() => crypto.randomUUID());
    this.idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS;
    this.maxFrameBytes = options.maxFrameBytes ?? DEFAULT_MAX_FRAME_BYTES;
    this.timers = options.timers ?? globalTimers;
  }

  on(event: 'connection', listener: (connection: Connection) => void) {
    if (event === 'connection') {
      this.connectionListeners.push(listener);
    }
    return this;
  }

  /** Registers a new client and announces it to every `connection` listener. */
  accept(socket: WebSocketLike): Connection {
    const connection = new WebSocketConnection(this.createId(), socket, this);
    this.connections.set(connection.id, connection);
    for (const listener of [...this.connectionListeners]) {
      runListener('connection', () => listener(connection));
    }
    return connection;
  }

  /** How many clients are connected. */
  get size() {
    return this.connections.size;
  }

  emit<E extends ServerEvent>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    this.sendToAll(encodeFrame({ event, args }));
    return true;
  }

  to(socketId: string) {
    return {
      emit: <E extends ServerEvent>(
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
      ) => {
        this.connections.get(socketId)?.emit(event, ...args);
        return true;
      },
    };
  }

  /** @internal Sends one encoded frame to everyone except `exceptId`. */
  sendToAll(frame: string, exceptId?: string) {
    for (const connection of this.connections.values()) {
      if (connection.id !== exceptId) {
        connection.send(frame);
      }
    }
  }

  /** @internal Called once per connection, when its socket goes away. */
  forget(id: string) {
    this.connections.delete(id);
  }
}

class WebSocketConnection implements Connection {
  readonly id: string;
  readonly broadcast: Connection['broadcast'];
  private readonly socket: WebSocketLike;
  private readonly host: WebSocketHost;
  private readonly listeners = new Map<string, Listener[]>();
  private closed = false;
  private idleTimer: unknown;

  constructor(id: string, socket: WebSocketLike, host: WebSocketHost) {
    this.id = id;
    this.socket = socket;
    this.host = host;
    this.broadcast = {
      emit: (event, ...args) => {
        host.sendToAll(encodeFrame({ event, args }), id);
        return true;
      },
    };
    socket.addEventListener('message', (message) => this.receive(message.data));
    // A failing socket reports `error` and then `close`: one disconnect
    socket.addEventListener('error', () => this.close());
    socket.addEventListener('close', () => this.close());
    this.resetIdleTimer();
  }

  on<E extends keyof ClientToServerEvents>(
    event: E,
    listener: ClientToServerEvents[E]
  ): this;
  on(event: 'disconnect', listener: () => void): this;
  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? [];
    listeners.push(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  emit<E extends ServerEvent>(
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ) {
    this.send(encodeFrame({ event, args }));
    return true;
  }

  /** Sends an encoded frame; dropped once the socket is no longer open. */
  send(frame: string) {
    if (this.closed || this.socket.readyState !== OPEN) {
      return;
    }
    try {
      this.socket.send(frame);
    } catch (error) {
      console.warn(`Could not send to ${this.id}:`, error);
    }
  }

  private receive(data: unknown) {
    if (this.closed) {
      return;
    }
    if (
      typeof data === 'string' &&
      exceedsBytes(data, this.host.maxFrameBytes)
    ) {
      console.warn(
        `Closing ${this.id}: frame over ${this.host.maxFrameBytes} bytes`
      );
      this.close(MESSAGE_TOO_BIG, 'Frame too large');
      return;
    }
    // Any frame, valid or not, proves the client is alive
    this.resetIdleTimer();
    const frame = parseClientFrame(data);
    if (!frame) {
      console.warn(`Ignored a malformed frame from ${this.id}`);
      return;
    }
    if ('ping' in frame) {
      this.send(encodeFrame({ pong: frame.ping }));
      return;
    }
    if (!isClientEvent(frame.event)) {
      console.warn(`Ignored unknown event "${frame.event}" from ${this.id}`);
      return;
    }

    const args = [...frame.args];
    if (frame.ack !== undefined) {
      args.push(this.replier(frame.ack));
    }
    this.dispatch(frame.event, args);
  }

  /** The ack callback handed to a handler: answers the sender, once. */
  private replier(ackId: number) {
    let pending: number | undefined = ackId;
    return (...replyArgs: unknown[]) => {
      if (pending !== undefined) {
        this.send(encodeFrame({ ack: pending, args: replyArgs }));
        pending = undefined;
      }
    };
  }

  private resetIdleTimer() {
    const { idleTimeoutMs, timers } = this.host;
    if (idleTimeoutMs <= 0) {
      return;
    }
    timers.clearTimeout(this.idleTimer);
    this.idleTimer = timers.setTimeout(() => {
      console.warn(`Closing ${this.id}: silent for ${idleTimeoutMs}ms`);
      this.close(IDLE_TIMEOUT, 'Idle timeout');
    }, idleTimeoutMs);
  }

  private close(code?: number, reason?: string) {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.host.timers.clearTimeout(this.idleTimer);
    this.host.forget(this.id);
    try {
      this.socket.close(code, reason);
    } catch {
      // Already closing or closed
    }
    this.dispatch('disconnect', []);
    this.listeners.clear();
  }

  private dispatch(event: string, args: unknown[]) {
    for (const listener of [...(this.listeners.get(event) ?? [])]) {
      runListener(event, () => listener(...args));
    }
  }
}

/** One throwing handler must neither skip the others nor kill the host. */
function runListener(event: string, run: () => void) {
  try {
    run();
  } catch (error) {
    console.error(`Handler for "${event}" threw:`, error);
  }
}
