import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { LobbyFullError, NameExistsError } from '../errors.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

describe('Lobby Service', () => {
  // When using Lobby.Default, it automatically includes LobbyConfig.Live via dependencies.
  // To override it, we need to use Layer.provide(LobbyConfig.Test) BUT since it's already provided,
  // we might need to construct the layer differently or use Layer.replace.
  // Actually, Effect.Service with dependencies is syntactic sugar for Layer.provide(Dependencies).
  // So Lobby.Default = Layer.effect(Lobby, make).pipe(Layer.provide(LobbyConfig.Live)).
  // Providing LobbyConfig.Test afterwards doesn't replace the inner provision.

  // We should use the raw layer if possible, but Effect.Service doesn't expose it easily unless we didn't use dependencies array.
  // Alternatively, we can use Layer.replace(LobbyConfig.Live, LobbyConfig.Test) ? No, we need to replace the tag.

  // Better approach: Since we want to test Lobby with a specific config, we should probably access the underlying effect if possible,
  // or just redefine the layer for testing using the internal `make` if it was exported.
  // But since it's not, we have to rely on `Lobby.Default` being "open" enough.

  // Actually, the `dependencies` property in `Effect.Service` creates a layer that has the dependencies provided.
  // If we want to override, we should probably NOT use Lobby.Default but Lobby.Live (if it existed without deps) or
  // we can just use `Lobby.pipe(Layer.provide(LobbyConfig.Test))` IF Lobby was just a Tag+Effect, but it's a Service.

  // Let's try `Layer.provideMerge` or just `Layer.suspend`?
  // No, the issue is that `Lobby.Default` is `Layer.effect(tag, make).pipe(Layer.provide(deps))`.
  // Once provided, the dependency is hidden/consumed.

  // Wait, I can't easily change `Lobby.Default` behavior from outside without hacking.
  // But wait, if I use `Layer.succeed` for the configuration, I can try to override it?

  // Let's try to define TestLayer as:
  // const TestLayer = Lobby.DefaultWithoutDependencies.pipe(Layer.provide(LobbyConfig.Test))
  // But we don't have DefaultWithoutDependencies.

  // Check `Lobby.ts` again.
  // export class Lobby extends Effect.Service<Lobby>()('@app/Lobby', { ... dependencies: [LobbyConfig.Live] })

  // If I remove dependencies from there and require the user to provide them, it solves testing but makes wiring harder.
  // OR I can export the `make` function?

  // Let's check DayVoting.ts. It has `static readonly Test = Layer.effect(this, make);`
  // I should add that to Lobby.ts as well.

  const TestLayer = Lobby.Test.pipe(Layer.provide(LobbyConfig.Test));

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
