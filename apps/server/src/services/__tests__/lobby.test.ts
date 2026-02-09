import { describe, expect, it } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { LobbyPlayer } from '@/core/LobbyPlayer.js';
import { LobbyFullError, NameExistsError } from '../errors.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

describe('Lobby Service', () => {
  const TestLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Test)
  );

  const TestLayerMaxPlayers10 = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.succeed(LobbyConfig, { maxPlayers: 10 }))
  );

  const TestLayerMaxPlayers100 = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.succeed(LobbyConfig, { maxPlayers: 100 }))
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

  it.effect('returns all players in insertion order', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;

      yield* lobby.addPlayer('Alice', 'socket-1');
      yield* lobby.addPlayer('Bob', 'socket-2');

      const players = yield* lobby.getAllPlayers;

      expect(players).toHaveLength(2);
      expect(players.map((player) => player.name)).toEqual(['Alice', 'Bob']);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('tracks player count updates', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;

      const emptyCount = yield* lobby.getPlayerCount;
      expect(emptyCount).toBe(0);

      yield* lobby.addPlayer('Alice', 'socket-1');

      const count = yield* lobby.getPlayerCount;
      expect(count).toBe(1);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('clears all players', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;

      yield* lobby.addPlayer('Alice', 'socket-1');
      yield* lobby.addPlayer('Bob', 'socket-2');

      yield* lobby.clear;

      const players = yield* lobby.getAllPlayers;
      const count = yield* lobby.getPlayerCount;

      expect(players).toHaveLength(0);
      expect(count).toBe(0);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect(
    'should not allow external mutation of getAllPlayers snapshot',
    () =>
      Effect.gen(function* () {
        // Arrange
        const lobby = yield* Lobby;
        yield* lobby.addPlayer('Alice', 'socket-1');

        // Act
        const snapshot = yield* lobby.getAllPlayers;
        (snapshot as LobbyPlayer[]).push(new LobbyPlayer('Eve', 'socket-2'));

        // Assert
        const count = yield* lobby.getPlayerCount;
        const snapshot2 = yield* lobby.getAllPlayers;
        expect(count).toBe(1);
        expect(snapshot2).toHaveLength(1);
        expect(snapshot2.map((p) => p.name)).toEqual(['Alice']);
      }).pipe(Effect.provide(TestLayerMaxPlayers10))
  );

  it.effect(
    'should never exceed maxPlayers under concurrent addPlayer calls',
    () =>
      Effect.gen(function* () {
        // Arrange
        const lobby = yield* Lobby;

        const adds = Array.from({ length: 20 }, (_, i) =>
          lobby.addPlayer(`Player${i}`, `socket-${i}`).pipe(Effect.either)
        );

        // Act
        const results = yield* Effect.all(adds, { concurrency: 'unbounded' });

        // Assert
        const successes = results.filter(Either.isRight);
        const failures = results.filter(Either.isLeft);

        expect(successes).toHaveLength(2);
        expect(failures).toHaveLength(18);

        for (const failure of failures) {
          expect(failure.left).toBeInstanceOf(LobbyFullError);
        }

        const count = yield* lobby.getPlayerCount;
        expect(count).toBe(2);
      }).pipe(Effect.provide(TestLayer))
  );

  it.effect(
    'should accept at most one player per name under concurrent adds',
    () =>
      Effect.gen(function* () {
        // Arrange
        const lobby = yield* Lobby;

        const adds = Array.from({ length: 10 }, (_, i) =>
          lobby.addPlayer('Alice', `socket-${i}`).pipe(Effect.either)
        );

        // Act
        const results = yield* Effect.all(adds, { concurrency: 'unbounded' });

        // Assert
        const successes = results.filter(Either.isRight);
        const failures = results.filter(Either.isLeft);

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(9);
        for (const failure of failures) {
          expect(failure.left).toBeInstanceOf(NameExistsError);
        }

        const count = yield* lobby.getPlayerCount;
        expect(count).toBe(1);
      }).pipe(Effect.provide(TestLayerMaxPlayers10))
  );

  it('should handle concurrent adds without race conditions', async () => {
    const program = Effect.gen(function* () {
      const lobby = yield* Lobby;

      const adds = Array.from({ length: 100 }, (_, i) =>
        lobby.addPlayer(`Player${i}`, `sid${i}`)
      );

      yield* Effect.all(adds, { concurrency: 'unbounded' });

      const count = yield* lobby.getPlayerCount;
      expect(count).toBe(100);
    });

    await Effect.runPromise(
      program.pipe(Effect.provide(TestLayerMaxPlayers100))
    );
  });
});
