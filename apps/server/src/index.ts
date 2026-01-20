import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { SocketHandlers } from './services/SocketHandlers.js';

const mainLayer = Layer.mergeAll(SocketHandlers.Default);

const program = Effect.gen(function* () {
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(program.pipe(Effect.provide(mainLayer)));
