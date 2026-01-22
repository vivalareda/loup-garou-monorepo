import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { AudioManager } from './services/AudioManager.js';
import { Game } from './services/Game.js';
import { GameFlow } from './services/GameFlow.js';
import { HttpServer } from './services/HttpServer.js';
import { Lobby } from './services/Lobby.js';
import { LobbyConfig } from './services/LobbyConfig.js';
import { SocketHandlers } from './services/SocketHandlers.js';
import { SocketServer } from './services/SocketServer.js';

// Layer composition: merging all service layers
// Effect will automatically resolve dependencies
const mainLayer = Layer.mergeAll(
  HttpServer.Live,
  LobbyConfig.Live,
  SocketServer.Default,
  Lobby.Default,
  AudioManager.Default,
  Game.Default,
  GameFlow.Default,
  SocketHandlers.Default
);

const program = Effect.gen(function* () {
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(program.pipe(Effect.provide(mainLayer)));
