import type { Server as HttpServer } from 'node:http';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Context, Effect, Layer, Ref } from 'effect';
import type { Server } from 'socket.io';

import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
// Import existing infrastructure
import { httpServer, startServer } from '@/server/http-server';
import { GameEvents } from '@/server/server-events';
import { io } from '@/server/sockets';

// =============================================================================
// Service Definitions (wrapping existing infrastructure)
// =============================================================================

/**
 * Socket.IO service - wraps the existing Socket.IO instance
 */
export class SocketIO extends Context.Tag('SocketIO')<
  SocketIO,
  Server<ClientToServerEvents, ServerToClientEvents>
>() { }

/**
 * HTTP Server service - wraps the existing HTTP server
 */
export class HttpServerService extends Context.Tag('HttpServer')<
  HttpServerService,
  HttpServer
>() { }

/**
 * Game state service - manages all game-related instances
 */
export class GameState extends Context.Tag('GameState')<
  GameState,
  {
    readonly game: Game;
    readonly deathManager: DeathManager;
    readonly audioManager: AudioManager;
    readonly specialScenarios: SpecialScenarios;
    readonly segmentsManager: SegmentsManager;
    readonly eventsActions: EventsActions;
    readonly gameEvents: GameEvents;
    readonly loversAlertCount: Ref.Ref<number>;
  }
>() { }

// =============================================================================
// Layers (simple wrappers - no resource management needed, already exists)
// =============================================================================

/**
 * Socket.IO layer - provides the existing io instance
 */
export const SocketIOLive = Layer.succeed(SocketIO, io);

/**
 * HTTP Server layer - provides the existing httpServer instance
 */
export const HttpServerLive = Layer.succeed(HttpServerService, httpServer);

/**
 * Creates the game state layer with all game instances
 */
const makeGameState = Effect.gen(function* () {
  const socketServer = yield* SocketIO;
  const loversAlertCount = yield* Ref.make(0);

  const deathManager = new DeathManager();
  const game = new Game(socketServer, deathManager);
  const audioManager = new AudioManager(deathManager);
  const specialScenarios = new SpecialScenarios(game, audioManager);
  const segmentsManager = new SegmentsManager(
    game,
    socketServer,
    audioManager,
    specialScenarios
  );
  const eventsActions = new EventsActions(game, segmentsManager, socketServer);
  const gameEvents = new GameEvents(
    game,
    segmentsManager,
    socketServer,
    eventsActions
  );

  return {
    game,
    deathManager,
    audioManager,
    specialScenarios,
    segmentsManager,
    eventsActions,
    gameEvents,
    loversAlertCount,
  };
});

/**
 * Game state layer - depends on SocketIO
 */
export const GameStateLive = Layer.effect(GameState, makeGameState);

// =============================================================================
// Helper Effects for Game State
// =============================================================================

export const resetLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  yield* Ref.set(loversAlertCount, 0);
});

export const incrementLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  yield* Ref.update(loversAlertCount, (n) => n + 1);
  return yield* Ref.get(loversAlertCount);
});

export const getLoversAlertCount = Effect.gen(function* () {
  const { loversAlertCount } = yield* GameState;
  return yield* Ref.get(loversAlertCount);
});

// =============================================================================
// Main Program
// =============================================================================

/**
 * Initialize and start the game server
 */
const serverProgram = Effect.gen(function* () {
  const gameState = yield* GameState;

  // Setup socket handlers
  yield* Effect.sync(() => {
    gameState.gameEvents.setupSocketHandlers();
  });

  yield* Effect.log('Server initialized successfully');
  yield* Effect.log('Press r to restart game, Ctrl+C to exit');

  // Start the HTTP server
  yield* Effect.sync(() => {
    startServer();
  });

  // Keep running
  return yield* Effect.never;
});

/**
 * Compose all layers
 */
const AppLayer = GameStateLive.pipe(
  Layer.provideMerge(SocketIOLive),
  Layer.provideMerge(HttpServerLive)
);

/**
 * Runnable program with all dependencies provided
 */
const main = serverProgram.pipe(Effect.provide(AppLayer));

// =============================================================================
// Entry Point
// =============================================================================

// Handle keyboard input for game restart
const setupKeyboardHandlers = () => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (key: string) => {
    const keyPressed = key.toString().toLowerCase();

    if (keyPressed === 'r') {
      console.log('\nRestarting game state...');
      // Note: Full restart with Effect would require rebuilding layers
      // For now, log that this needs the non-Effect restart approach
      // or implement state reset via Refs
      console.log('Game restart not yet implemented in Effect version');
      console.log('Use the original index.ts for restart functionality');
    }

    if (keyPressed === '\u0003') {
      console.log('\nShutting down...');
      process.exit(0);
    }
  });
};

// Start everything
setupKeyboardHandlers();

Effect.runPromise(main).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
