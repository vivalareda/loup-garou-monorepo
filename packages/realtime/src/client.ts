import {
  type ClientToServerEvents,
  encodeFrame,
  isServerEvent,
  parseServerFrame,
  type ServerToClientEvents,
} from '@repo/types';

/**
 * The slice of a WebSocket the client uses. The browser's, React Native's
 * and Node's (22+) global `WebSocket` all provide it; tests inject a fake.
 * Methods (not function properties) so the platforms' richer listener
 * types still match.
 */
export type ClientWebSocket = {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: 'open' | 'error', listener: () => void): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: unknown }) => void
  ): void;
  addEventListener(
    type: 'close',
    listener: (event: { code: number }) => void
  ): void;
};

export type ClientWebSocketConstructor = new (url: string) => ClientWebSocket;

export type DisconnectReason =
  /** `disconnect()` was called: no reconnect. */
  | 'client disconnect'
  /** The connection dropped (server gone, network lost): reconnecting. */
  | 'transport close';

/** Lifecycle events, emitted locally and never sent by the server. */
export type ReservedEvents = {
  /** Every time a connection opens, including after a reconnect. */
  connect: () => void;
  disconnect: (reason: DisconnectReason) => void;
  /** A connection attempt failed; the next one is already scheduled. */
  connect_error: (error: Error) => void;
};

export type ListenEvents = ServerToClientEvents & ReservedEvents;

type ListenEvent = keyof ListenEvents;

type EmitEvent = keyof ClientToServerEvents;

export type RealtimeClientOptions = {
  /** Open the connection immediately (default true); else call `connect()`. */
  autoConnect?: boolean;
  /** Reconnect after an unrequested drop (default true). */
  reconnect?: boolean;
  /** First reconnect delay, doubled per failed attempt (default 1000). */
  reconnectDelayMs?: number;
  /** Cap on the reconnect delay (default 5000). */
  reconnectDelayMaxMs?: number;
  /** Jitter, as a fraction of the delay (default 0.5). */
  randomizationFactor?: number;
  /**
   * Heartbeat: a `{ ping }` frame this long after the last pong (default
   * 20000; 0 disables). Must stay well under the server's idle timeout.
   */
  pingIntervalMs?: number;
  /** No pong within this long closes the connection (default 10000). */
  pingTimeoutMs?: number;
  /** A handshake still pending after this long is aborted (default 10000). */
  connectTimeoutMs?: number;
  /**
   * Events queued when emitted before the first connection ever opens,
   * flushed in order before `connect` fires (default: none, every other
   * early emit is dropped). Only list events that cannot go stale, such
   * as a join or a read: never admin commands or game actions.
   */
  bufferBeforeConnect?: readonly EmitEvent[];
  /** Defaults to the global `WebSocket`. */
  WebSocket?: ClientWebSocketConstructor;
};

type Listener = (...args: unknown[]) => void;

/** Sees every server event (never the reserved ones), as Socket.io's `onAny`. */
export type AnyListener = (
  event: keyof ServerToClientEvents,
  ...args: unknown[]
) => void;

type ListenerEntry = { listener: Listener; once: boolean };

type PendingAck = { callback: Listener; sent: boolean };

type Timer = ReturnType<typeof setTimeout> | undefined;

/** `WebSocket.OPEN`, without depending on a global `WebSocket`. */
const OPEN = 1;
const NORMAL_CLOSURE = 1000;

/** Private-range code for a connection this client gave up on. */
const ABANDONED = 4000;

function resolveWebSocket(
  injected: ClientWebSocketConstructor | undefined
): ClientWebSocketConstructor {
  const WebSocketImpl =
    injected ??
    (globalThis as { WebSocket?: ClientWebSocketConstructor }).WebSocket;

  if (!WebSocketImpl) {
    throw new Error('No global WebSocket: pass options.WebSocket');
  }

  return WebSocketImpl;
}

/**
 * A typed client for the game server's WebSocket protocol (`@repo/types`
 * wire.ts), shaped like the Socket.io client it replaced:
 *
 * - `on` / `once` / `off` for server events plus `connect`, `disconnect`
 *   and `connect_error`; `off(event)` without a listener removes them all.
 * - `emit(event, ...args)`; when the last argument is a function it is the
 *   ack callback, called with the server's reply.
 * - Reconnects after an unrequested drop with capped exponential backoff
 *   and jitter, firing `connect` again each time (the mobile app rejoins
 *   with its session token from there).
 * - Notices a dead connection that never reports `close` (broken network,
 *   suspended phone): it pings the server and gives up on the socket when
 *   the pong is late, or when the handshake stalls, then reconnects.
 * - Emits made while not connected are dropped (`emit` returns false and
 *   warns): replaying them later would act on a stale game (an extra
 *   admin "next segment" from a dashboard opened during an outage, a vote
 *   before the rejoin); the rejoin snapshot restores the state instead,
 *   and what a new connection needs is re-sent from `connect` listeners.
 *   The one exception: events listed in `bufferBeforeConnect` emitted
 *   before the first connection ever opens are queued and flushed, in
 *   order, before `connect` fires (a fast first `player:join` tap).
 *   `disconnect()` discards the queue. Acks still waiting when
 *   the connection drops are never called: the reply belonged to a server
 *   connection that no longer exists.
 */
export class RealtimeClient {
  readonly url: string;
  private readonly WebSocketImpl: ClientWebSocketConstructor;
  private readonly reconnects: boolean;
  private readonly delayMs: number;
  private readonly delayMaxMs: number;
  private readonly jitter: number;
  private readonly pingIntervalMs: number;
  private readonly pingTimeoutMs: number;
  private readonly connectTimeoutMs: number;
  private readonly bufferable: ReadonlySet<string>;

  private readonly listeners = new Map<string, ListenerEntry[]>();
  private readonly anyListeners: AnyListener[] = [];
  private readonly pendingAcks = new Map<number, PendingAck>();
  private queue: string[] = [];
  private nextAckId = 0;

  private socket: ClientWebSocket | null = null;
  private isOpen = false;
  /** True between `connect()` and `disconnect()`: keep reconnecting. */
  private active = false;
  /** Whether any connection has opened yet: decides queue vs drop. */
  private hasConnected = false;
  private attempts = 0;
  private pingSeq = 0;
  private reconnectTimer: Timer;
  private connectTimer: Timer;
  private pingTimer: Timer;
  private pongTimer: Timer;

  constructor(url: string, options: RealtimeClientOptions = {}) {
    this.url = url;
    this.WebSocketImpl = resolveWebSocket(options.WebSocket);
    this.reconnects = options.reconnect ?? true;
    this.delayMs = options.reconnectDelayMs ?? 1000;
    this.delayMaxMs = options.reconnectDelayMaxMs ?? 5000;
    this.jitter = options.randomizationFactor ?? 0.5;
    this.pingIntervalMs = options.pingIntervalMs ?? 20_000;
    this.pingTimeoutMs = options.pingTimeoutMs ?? 10_000;
    this.connectTimeoutMs = options.connectTimeoutMs ?? 10_000;
    this.bufferable = new Set(options.bufferBeforeConnect ?? []);

    if (options.autoConnect ?? true) {
      this.connect();
    }
  }

  /** Whether a connection is open right now. */
  get connected() {
    return this.isOpen;
  }

  /** Opens the connection (now, even if a reconnect was pending). */
  connect(): this {
    this.active = true;

    if (this.socket) {
      return this;
    }

    this.clearReconnectTimer();
    this.open();

    return this;
  }

  /** Closes the connection for good: no reconnect, queued emits dropped. */
  disconnect(): this {
    this.active = false;
    this.clearReconnectTimer();
    const socket = this.socket;
    const wasOpen = this.release();
    this.queue = [];
    this.pendingAcks.clear();

    try {
      socket?.close(NORMAL_CLOSURE);
    } catch {
      // Already closing
    }

    if (wasOpen) {
      this.dispatch('disconnect', ['client disconnect']);
    }

    return this;
  }

  on<E extends ListenEvent>(event: E, listener: ListenEvents[E]): this {
    return this.addListener(event, listener as Listener, false);
  }

  once<E extends ListenEvent>(event: E, listener: ListenEvents[E]): this {
    return this.addListener(event, listener as Listener, true);
  }

  /** Removes `listener`, or every listener of `event` when omitted. */
  off<E extends ListenEvent>(event: E, listener?: ListenEvents[E]): this {
    if (listener === undefined) {
      this.listeners.delete(event);

      return this;
    }

    const remaining = (this.listeners.get(event) ?? []).filter(
      (entry) => entry.listener !== listener
    );

    if (remaining.length > 0) {
      this.listeners.set(event, remaining);
    } else {
      this.listeners.delete(event);
    }

    return this;
  }

  /** Adds a listener for every server event (debugging, recording). */
  onAny(listener: AnyListener): this {
    this.anyListeners.push(listener);

    return this;
  }

  /**
   * Sends an event; a trailing function is the ack callback. Returns false
   * when the emit was dropped because the connection is down.
   */
  emit<E extends EmitEvent>(
    event: E,
    ...args: Parameters<ClientToServerEvents[E]>
  ): boolean {
    const payload: unknown[] = [...args];
    const [last] = payload.slice(-1);

    if (typeof last !== 'function') {
      return (
        this.send(event, encodeFrame({ event, args: payload })) !== 'dropped'
      );
    }

    payload.pop();
    const ack = this.nextAckId;
    this.nextAckId += 1;

    const outcome = this.send(
      event,
      encodeFrame({ event, args: payload, ack })
    );

    if (outcome !== 'dropped') {
      this.pendingAcks.set(ack, {
        callback: last as Listener,
        sent: outcome === 'sent',
      });
    }

    return outcome !== 'dropped';
  }

  private addListener(event: string, listener: Listener, once: boolean) {
    const entries = this.listeners.get(event) ?? [];
    entries.push({ listener, once });
    this.listeners.set(event, entries);

    return this;
  }

  /**
   * Sends now when open; queues an allowlisted event before the first
   * connection; drops anything else.
   */
  private send(event: string, frame: string): 'sent' | 'queued' | 'dropped' {
    if (this.trySend(frame)) {
      return 'sent';
    }

    if (!this.hasConnected && this.bufferable.has(event)) {
      this.queue.push(frame);

      return 'queued';
    }

    console.warn(`[realtime] Dropped "${event}": not connected`);

    return 'dropped';
  }

  private trySend(frame: string) {
    if (!(this.isOpen && this.socket?.readyState === OPEN)) {
      return false;
    }

    try {
      this.socket.send(frame);

      return true;
    } catch {
      // The socket is going down: its `close` event follows
      return false;
    }
  }

  private open() {
    let socket: ClientWebSocket;

    try {
      socket = new this.WebSocketImpl(this.url);
    } catch (error) {
      this.dispatch('connect_error', [toError(error)]);
      this.scheduleReconnect();

      return;
    }

    this.socket = socket;

    if (this.connectTimeoutMs > 0) {
      this.connectTimer = setTimeout(
        () => this.abandon('WebSocket handshake timed out'),
        this.connectTimeoutMs
      );
    }

    // Events from a socket this client already let go of are ignored
    socket.addEventListener('open', () => {
      if (socket === this.socket) {
        this.handleOpen();
      }
    });
    socket.addEventListener('message', (message) => {
      if (socket === this.socket) {
        this.receive(message.data);
      }
    });
    // `error` always precedes `close`, which does the work
    socket.addEventListener('close', (event) => {
      if (socket === this.socket) {
        this.handleClose(
          `WebSocket closed before opening (code ${event.code})`
        );
      }
    });
  }

  private handleOpen() {
    this.connectTimer = clear(this.connectTimer);
    this.isOpen = true;
    this.hasConnected = true;
    this.attempts = 0;
    const queued = this.queue;
    this.queue = [];

    for (const frame of queued) {
      this.trySend(frame);
    }

    for (const pending of this.pendingAcks.values()) {
      pending.sent = true;
    }

    this.schedulePing();
    this.dispatch('connect', []);
  }

  private schedulePing() {
    if (this.pingIntervalMs <= 0) {
      return;
    }

    this.pingTimer = setTimeout(() => this.sendPing(), this.pingIntervalMs);
  }

  private sendPing() {
    this.pingTimer = undefined;
    this.pingSeq += 1;
    this.trySend(encodeFrame({ ping: this.pingSeq }));
    this.pongTimer = setTimeout(
      () => this.abandon('Heartbeat timed out'),
      this.pingTimeoutMs
    );
  }

  private handlePong(seq: number) {
    if (seq !== this.pingSeq || this.pongTimer === undefined) {
      return;
    }

    this.pongTimer = clear(this.pongTimer);
    this.schedulePing();
  }

  /**
   * Gives up on a socket that went silent without closing: forget it now
   * (its late events are ignored), close it, and reconnect as on a drop.
   */
  private abandon(failure: string) {
    const socket = this.socket;
    this.handleClose(failure);

    try {
      socket?.close(ABANDONED, failure);
    } catch {
      // Already closing
    }
  }

  /** Lets go of the current socket and its timers; returns whether it was open. */
  private release() {
    const wasOpen = this.isOpen;
    this.socket = null;
    this.isOpen = false;
    this.connectTimer = clear(this.connectTimer);
    this.pingTimer = clear(this.pingTimer);
    this.pongTimer = clear(this.pongTimer);

    return wasOpen;
  }

  /** The socket closed (or was abandoned); `failure` describes a failed attempt. */
  private handleClose(failure: string) {
    const wasOpen = this.release();

    for (const [id, pending] of this.pendingAcks) {
      if (pending.sent) {
        this.pendingAcks.delete(id);
      }
    }

    if (wasOpen) {
      this.dispatch('disconnect', ['transport close']);
    } else {
      this.dispatch('connect_error', [new Error(failure)]);
    }

    // A listener may have called disconnect() or connect() meanwhile
    if (this.active && this.reconnects && !this.socket) {
      this.scheduleReconnect();
    }
  }

  private receive(data: unknown) {
    const frame = parseServerFrame(data);

    if (!frame) {
      console.warn('[realtime] Ignored a malformed frame');

      return;
    }

    if ('pong' in frame) {
      this.handlePong(frame.pong);

      return;
    }

    if ('ack' in frame) {
      const pending = this.pendingAcks.get(frame.ack);

      if (pending) {
        this.pendingAcks.delete(frame.ack);
        runListener('ack', () => pending.callback(...frame.args));
      }

      return;
    }

    // Unknown events (a newer server) are ignored, and the server can
    // never trigger the reserved lifecycle events
    const { event, args } = frame;

    if (!isServerEvent(event)) {
      return;
    }

    for (const listener of [...this.anyListeners]) {
      runListener(event, () => listener(event, ...args));
    }

    this.dispatch(event, args);
  }

  private dispatch(event: string, args: unknown[]) {
    const entries = this.listeners.get(event);

    if (!entries) {
      return;
    }

    if (entries.some((entry) => entry.once)) {
      const kept = entries.filter((entry) => !entry.once);

      if (kept.length > 0) {
        this.listeners.set(event, kept);
      } else {
        this.listeners.delete(event);
      }
    }

    for (const { listener } of [...entries]) {
      runListener(event, () => listener(...args));
    }
  }

  private scheduleReconnect() {
    if (!(this.active && this.reconnects)) {
      return;
    }

    const delay = this.backoffDelay(this.attempts);
    this.attempts += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;

      if (this.active && !this.socket) {
        this.open();
      }
    }, delay);
  }

  /** `delayMs * 2^attempt`, ± `jitter` of itself, capped at `delayMaxMs`. */
  private backoffDelay(attempt: number) {
    const base = Math.min(this.delayMaxMs, this.delayMs * 2 ** attempt);
    const deviation = base * this.jitter * (Math.random() * 2 - 1);

    return Math.round(Math.max(0, Math.min(this.delayMaxMs, base + deviation)));
  }

  private clearReconnectTimer() {
    this.reconnectTimer = clear(this.reconnectTimer);
  }
}

/** Clears a timer; returns `undefined` to store back in its field. */
function clear(timer: Timer): undefined {
  if (timer !== undefined) {
    clearTimeout(timer);
  }

  return;
}

export function createRealtimeClient(
  url: string,
  options?: RealtimeClientOptions
) {
  return new RealtimeClient(url, options);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

/** A throwing listener must not skip the others or break the client. */
function runListener(event: string, run: () => void) {
  try {
    run();
  } catch (error) {
    console.error(`[realtime] Listener for "${event}" threw:`, error);
  }
}
