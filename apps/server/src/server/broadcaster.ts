import type { ServerToClientEvents } from '@repo/types';

type Emit = <E extends keyof ServerToClientEvents>(
  event: E,
  ...args: Parameters<ServerToClientEvents[E]>
) => unknown;

/**
 * The slice of the transport the game logic needs: broadcast to everyone,
 * or emit to one player's socket id. Socket.io's `Server` satisfies it
 * structurally; a Cloudflare Durable Object can implement it over raw
 * WebSockets, keeping `core/` and `segments/` transport-agnostic.
 */
export type Broadcaster = {
  emit: Emit;
  to(socketId: string): { emit: Emit };
};
