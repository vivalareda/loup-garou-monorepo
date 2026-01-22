import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { SocketHandlers } from './services/SocketHandlers.js';

const mainLayer = Layer.mergeAll(SocketHandlers.Default);
const logger = Logger.minimumLogLevel(LogLevel.Debug);

const program = Effect.gen(function* () {
  yield* Effect.log('Server starting...');
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(
  program.pipe(Effect.provide(mainLayer), Effect.provide(logger))
);
