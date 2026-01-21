import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { SocketHandlers } from './services/SocketHandlers.js';
import { DeathManager } from './services/DeathManager.js';

const mainLayer = Layer.mergeAll(SocketHandlers.Default, DeathManager.Default);

const program = Effect.gen(function* () {
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(program.pipe(Effect.provide(mainLayer)));
