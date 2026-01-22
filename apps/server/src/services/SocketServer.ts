import type { Server } from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Effect, Layer } from 'effect';
import { Server as SocketIOServer } from 'socket.io';
import { HttpServer } from './HttpServer.js';

export type SocketIOInstance = SocketIOServer<
  ClientToServerEvents,
  ServerToClientEvents
>;

const acquire = (httpServer: Server) =>
  Effect.sync(() => {
    const io: SocketIOInstance = new SocketIOServer<
      ClientToServerEvents,
      ServerToClientEvents
    >(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['*'],
        credentials: true,
      },
      pingTimeout: 60_000,
      pingInterval: 25_000,
    });
    return io;
  });

const release = (io: SocketIOInstance) =>
  Effect.promise(async () => {
    console.log('Closing Socket.IO server...');
    await io.close();
    console.log('Socket.IO server closed');
  });

export class SocketServer extends Effect.Service<SocketServer>()(
  '@app/SocketServer',
  {
    scoped: Effect.gen(function* () {
      const httpServer = yield* HttpServer;
      return yield* Effect.acquireRelease(acquire(httpServer), release);
    }),
    dependencies: [HttpServer.Live],
  }
) {
  static Test = Layer.succeed(
    this,
    {
      to: () => ({ emit: () => Effect.void }),
      emit: () => {
        Effect.void;
      },
      on: () => {
        Effect.void;
      },
    } as unknown as SocketIOInstance
  );
}
