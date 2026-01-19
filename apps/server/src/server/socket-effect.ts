import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Context, Effect, Layer, Stream } from 'effect';
import type { Server, Socket } from 'socket.io';
import { SocketError } from '../Domain/socket-error';

// Type definitions
export type ServerSocket = Server<ClientToServerEvents, ServerToClientEvents>;
export type ClientSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/**
 * Service Definition for Socket.io
 */
export class SocketService extends Context.Tag('SocketService')<
  SocketService,
  {
    readonly emit: <E extends keyof ServerToClientEvents>(
      event: E,
      ...args: Parameters<ServerToClientEvents[E]>
    ) => Effect.Effect<void, SocketError>;

    readonly to: (sid: string) => {
      emit: <E extends keyof ServerToClientEvents>(
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
      ) => Effect.Effect<void, SocketError>;
    };

    readonly on: <E extends keyof ClientToServerEvents>(
      event: E
    ) => Stream.Stream<Parameters<ClientToServerEvents[E]>, SocketError>;

    readonly getServer: Effect.Effect<ServerSocket>;
  }
>() {}

/**
 * Live Implementation
 */
export const SocketLive = (io: ServerSocket) =>
  Layer.effect(
    SocketService,
    Effect.succeed({
      emit: <E extends keyof ServerToClientEvents>(
        event: E,
        ...args: Parameters<ServerToClientEvents[E]>
      ) =>
        Effect.try({
          try: () => {
            // biome-ignore lint/suspicious/noExplicitAny: <Socket.io types are complex>
            io.emit(event as any, ...(args as any));
          },
          catch: (error) =>
            new SocketError({ message: 'Emit failed', cause: error }),
        }),
      to: (sid: string) => ({
        emit: <E extends keyof ServerToClientEvents>(
          event: E,
          ...args: Parameters<ServerToClientEvents[E]>
        ) =>
          Effect.try({
            try: () => {
              // biome-ignore lint/suspicious/noExplicitAny: <Socket.io types are complex>
              io.to(sid).emit(event as any, ...(args as any));
            },
            catch: (error) =>
              new SocketError({
                message: `Emit to ${sid} failed`,
                cause: error,
              }),
          }),
      }),
      on: <E extends keyof ClientToServerEvents>(event: E) =>
        Stream.async<Parameters<ClientToServerEvents[E]>, SocketError>(
          (emit) => {
            io.on('connection', (socket) => {
              // biome-ignore lint/suspicious/noExplicitAny: <Socket.io types are complex>
              socket.on(event as any, (...args: any[]) => {
                // biome-ignore lint/suspicious/noExplicitAny: <Socket.io types are complex>
                emit.single(args as any);
              });
            });
            // Cleanup? Socket.io listeners are tricky to clean up globally without context of specific socket
            // For now, this is a basic implementation.
          }
        ),
      getServer: Effect.succeed(io),
    })
  );
