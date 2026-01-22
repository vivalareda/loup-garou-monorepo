import { Effect } from 'effect';
import { SocketServer } from './services/SocketServer.js';

const program = Effect.gen(function* () {
  const io = yield* SocketServer;
  console.log('io:', io);
  console.log('typeof io:', typeof io);
  console.log('io.constructor.name:', io.constructor?.name);
  console.log('Object.keys(io):', Object.keys(io));
  console.log('io.on:', io.on);
  console.log('typeof io.on:', typeof io.on);
});

Effect.runPromise(Effect.scoped(program.pipe(Effect.provide(SocketServer.Default))));
