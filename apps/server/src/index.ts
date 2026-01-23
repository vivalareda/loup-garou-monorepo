import { NodeRuntime } from '@effect/platform-node';
import { Effect, Layer, Logger, LogLevel } from 'effect';
import { SocketHandlers } from './services/SocketHandlers.js';

const loggerLayer = Logger.minimumLogLevel(LogLevel.Debug);
const mainLayer = Layer.mergeAll(SocketHandlers.Default, loggerLayer);

const program = Effect.gen(function* () {
  yield* Effect.log('Server starting...');
  const handlers = yield* SocketHandlers;
  yield* handlers.setupHandlers;

  return yield* Effect.never;
});

NodeRuntime.runMain(program.pipe(Effect.provide(mainLayer)));
