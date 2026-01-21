import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { LobbyFullError, NameExistsError } from '../errors.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

describe('Lobby Service', () => {
  const TestLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Test)
  );

  it.effect('adds a player to the list correctly', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const player = yield* lobby.addPlayer('Alice', 'socket-1');

      expect(player.name).toBe('Alice');
      expect(player.sid).toBe('socket-1');
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('should fail if name is taken', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      yield* lobby.addPlayer('Alice', 'socket-1');

      const error = yield* lobby
        .addPlayer('Alice', 'socket-2')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(NameExistsError);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('should fail if exceeds player count', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;

      yield* lobby.addPlayer('Alice', 'socket-1');
      yield* lobby.addPlayer('Bob', 'socket-2');

      const error = yield* lobby
        .addPlayer('Charlie', 'socket-3')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(LobbyFullError);
    }).pipe(Effect.provide(TestLayer))
  );

  // it('should handle concurrent adds without race conditions', async () => {
  //   const testLayer = Layer.mergeAll(Lobby.Default, LobbyConfig.Live);
  //
  //   const program = Effect.gen(function* () {
  //     const lobby = yield* Lobby;
  //
  //     const adds = Array.from({ length: 100 }, (_, i) =>
  //       lobby.addPlayer(`Player${i}`, `sid${i}`)
  //     );
  //
  //     yield* Effect.all(adds, { concurrency: 'unbounded' });
  //
  //     const count = yield* lobby.getPlayerCount;
  //     expect(count).toBe(100);
  //   });
  //
  //   await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  // });
});
