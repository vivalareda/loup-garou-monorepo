import type { ClientToServerEvents } from '@repo/types';
import type { Broadcaster } from '@/server/broadcaster';

type ClientEvent = keyof ClientToServerEvents;

/**
 * One connected client, as the socket handlers see it: its id, the client
 * events it sends (plus `disconnect` when it drops), and emits back to it
 * or to everyone else. A handler's arguments come from the client's
 * message; for `agent:get-state` the last one is a reply callback the
 * transport routes back to the sender. Socket.io's `Socket` satisfies it
 * structurally; a raw WebSocket host implements it over JSON frames.
 *
 * Contract every transport must honor:
 * - `on` adds a listener; several may observe the same event (GameEvents
 *   and the narrator wiring both listen for `disconnect`).
 * - `id` is stable for the connection's life and never reused, even when
 *   the same player reconnects; otherwise an old connection's late close
 *   would mark its replacement disconnected.
 * - `disconnect` fires exactly once (a WebSocket `error` then `close` is
 *   one disconnect, or the reconnect grace timer restarts), and no client
 *   event is dispatched after it.
 */
export type Connection = {
  readonly id: string;
  on<E extends ClientEvent>(
    event: E,
    listener: ClientToServerEvents[E]
  ): unknown;
  on(event: 'disconnect', listener: () => void): unknown;
  emit: Broadcaster['emit'];
  broadcast: { emit: Broadcaster['emit'] };
};

/**
 * The transport the socket handlers run on: a `Broadcaster` that also
 * announces each new client. Socket.io's `Server` satisfies it structurally.
 * `on` adds a listener: GameEvents and the narrator wiring each register
 * their own `connection` handler, and both must see every client.
 */
export type ConnectionHost = Broadcaster & {
  on(event: 'connection', listener: (connection: Connection) => void): unknown;
};
