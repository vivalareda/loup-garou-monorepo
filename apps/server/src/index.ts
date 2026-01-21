import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { DeathManager } from './services/death-manager.js';
import { LobbyConfig } from './services/lobby-config.js';
import { SocketHandlers } from './services/socket-handlers.js';

const mainLayer = Layer.mergeAll(
  SocketHandlers.Default,
  DeathManager.Default,
  LobbyConfig.Live
);

const program = Effect.gen(function* () {
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(program.pipe(Effect.provide(mainLayer)));
