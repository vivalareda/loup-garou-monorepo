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
 */
export type ConnectionHost = Broadcaster & {
  on(event: 'connection', listener: (connection: Connection) => void): unknown;
};
