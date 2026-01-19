import { createServer } from 'node:http';
import { NodeRuntime } from '@effect/platform-node';
import { Config, Effect, Layer } from 'effect';
import { Server } from 'socket.io';
import { DeathManagerLive } from './core/death-manager-effect';
import { GameActionsLive } from './core/game-actions-effect';
import { GameLive } from './core/game-effect';
import { AudioManagerLive } from './segments/audio-manager-effect';
import { SegmentsManagerLive } from './segments/segments-manager-effect';
import { EventsActionsLive } from './server/events-actions-effect';
import { ServerEventsLive } from './server/server-events-effect';
import { SocketLive } from './server/socket-effect';

// 1. Setup the HTTP Server and Socket.io instance
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: '*',
  },
});

// 2. Define the main program layer
const MainLayer = Layer.mergeAll(
  ServerEventsLive,
  // Ensure all dependencies are provided
  EventsActionsLive,
  SegmentsManagerLive,
  GameActionsLive,
  AudioManagerLive,
  GameLive,
  DeathManagerLive,
  SocketLive(io)
);

// 3. Define the main program logic
const program = Effect.gen(function* (_) {
  yield* _(Effect.log('Server starting...'));

  // Start the HTTP server
  const port = yield* _(Config.number('PORT').pipe(Config.withDefault(3001)));

  yield* _(
    Effect.promise(
      () =>
        new Promise<void>((resolve) => {
          httpServer.listen(port, () => {
            console.log(`Server listening on port ${port}`);
            resolve();
          });
        })
    )
  );

  // Keep the process alive
  yield* _(Effect.never);
});

// 4. Run the program
const runnable = program.pipe(Effect.provide(MainLayer));

NodeRuntime.runMain(runnable);
