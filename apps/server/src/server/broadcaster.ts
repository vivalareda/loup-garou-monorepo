import type { ServerToClientEvents } from '@repo/types';

type Emit = <E extends keyof ServerToClientEvents>(
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => void;

/**
 * The slice of the transport the game logic needs: broadcast to everyone,
 * or emit to one player's socket id. `WebSocketHost` implements it over
 * raw WebSockets (on Node or in a Durable Object), keeping `core/` and
 * `segments/` transport-agnostic.
 */
export type Broadcaster = {
  emit: Emit;
  to(socketId: string): { emit: Emit };
};
