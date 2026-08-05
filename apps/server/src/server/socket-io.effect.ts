import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Context, Effect, Layer, Scope } from 'effect';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import { HttpServerService } from './http-server.effect';

/**
 * Socket.IO Server service tag
 */
export class SocketIOServer extends Context.Tag('SocketIOServer')<
  SocketIOServer,
  {
    readonly io: Server<ClientToServerEvents, ServerToClientEvents>;
  }
>() {}

/**
 * Socket.IO Server configuration
 */
export interface SocketIOConfig {
  readonly cors: {
    readonly origin: string;
    readonly methods: string[];
    readonly allowedHeaders: string[];
    readonly credentials: boolean;
  };
  readonly pingTimeout: number;
  readonly pingInterval: number;
}

/**
 * Default Socket.IO configuration
 */
const defaultConfig: SocketIOConfig = {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['*'],
    credentials: true,
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
};

/**
 * Creates the Socket.IO server with proper resource management
 */
const make = (config: SocketIOConfig = defaultConfig) =>
  Effect.gen(function* () {
    const { server } = yield* HttpServerService;
    const scope = yield* Effect.scope;

    const io = yield* Effect.acquireRelease(
      Effect.sync(() => {
        const socketServer = new Server<
          ClientToServerEvents,
          ServerToClientEvents
        >(server, config);
        console.log('Socket.IO server initialized');
        return socketServer;
      }),
      (io) =>
        Effect.sync(() => {
          console.log('Closing Socket.IO server...');
          io.removeAllListeners();
          io.close();
          console.log('Socket.IO server closed');
        })
    );

    // Add finalizer to scope
    yield* Scope.addFinalizer(
      scope,
      Effect.sync(() => {
        console.log('Socket.IO cleanup complete');
      })
    );

    return { io };
  });

/**
 * Socket.IO Server layer with custom configuration
 */
export const makeSocketIOLayer = (config?: SocketIOConfig) =>
  Layer.scoped(SocketIOServer, make(config));

/**
 * Socket.IO Server layer with default configuration
 */
export const SocketIOServerLive = makeSocketIOLayer();

/**
 * Socket connection event handler type
 */
export type SocketHandler = (
  socket: Socket<ClientToServerEvents, ServerToClientEvents>
) => Effect.Effect<void, never, never>;

/**
 * Register a connection handler for Socket.IO
 */
export const onConnection = (handler: SocketHandler) =>
  Effect.gen(function* () {
    const { io } = yield* SocketIOServer;

    yield* Effect.async<void>((_resume) => {
      io.on('connection', (socket) => {
        // Run the handler in the Effect runtime
        Effect.runPromise(handler(socket)).catch((error) => {
          console.error('Error in socket handler:', error);
        });
      });
      // This never completes - it keeps listening
    });
  });

/**
 * Emit an event to all connected clients
 */
export const emitToAll = <K extends keyof ServerToClientEvents>(
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) =>
  Effect.gen(function* () {
    const { io } = yield* SocketIOServer;
    yield* Effect.sync(() => {
      io.emit(event, ...args);
    });
  });

/**
 * Emit an event to a specific socket
 */
export const emitToSocket = <K extends keyof ServerToClientEvents>(
  socketId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) =>
  Effect.gen(function* () {
    const { io } = yield* SocketIOServer;
    yield* Effect.sync(() => {
      io.to(socketId).emit(event, ...args);
    });
  });

/**
 * Broadcast an event to all clients except the sender
 */
export const broadcastFrom = <K extends keyof ServerToClientEvents>(
  socket: Socket<ClientToServerEvents, ServerToClientEvents>,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
) =>
  Effect.sync(() => {
    socket.broadcast.emit(event, ...args);
  });
