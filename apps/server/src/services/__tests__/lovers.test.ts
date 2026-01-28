import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

describe('Lovers (Game Service)', () => {
  const LobbyTest = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Test)
  );

  const GameTest = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyTest)
  );

  const TestLayer = Layer.mergeAll(LobbyTest, GameTest);

  it.effect('tracks lover pairs correctly', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Hunter', 'hunter-1');
      yield* lobby.addPlayer('Partner', 'lover-2');
      yield* game.startGame;

      const initialPartner = yield* game.getPartner('hunter-1');
      expect(initialPartner).toBeNull();
      expect(yield* game.isPlayerLover('hunter-1')).toBe(false);

      yield* game.setLovers('hunter-1', 'lover-2');

      const hunterPartner = yield* game.getPartner('hunter-1');
      const partnerPartner = yield* game.getPartner('lover-2');

      expect(hunterPartner?.getSocketId()).toBe('lover-2');
      expect(partnerPartner?.getSocketId()).toBe('hunter-1');
      expect(yield* game.isPlayerLover('hunter-1')).toBe(true);
      expect(yield* game.isPlayerLover('lover-2')).toBe(true);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('isAnyLoverHunter returns true when hunter is a lover', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Hunter', 'hunter-1');
      yield* lobby.addPlayer('Partner', 'lover-2');
      yield* game.startGame;

      expect(yield* game.isAnyLoverHunter).toBe(false);

      yield* game.setLovers('hunter-1', 'lover-2');

      const players = yield* game.getPlayers;
      const hunterPlayer = players.find((p) => p.getRole() === 'HUNTER');

      if (hunterPlayer !== undefined) {
        yield* game.setLovers(hunterPlayer.getSocketId(), 'lover-2');
        expect(yield* game.isAnyLoverHunter).toBe(true);
      }
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('getPartner returns null for non-lovers', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Alice', 'socket-1');
      yield* lobby.addPlayer('Bob', 'socket-2');
      yield* game.startGame;

      yield* game.setLovers('socket-1', 'socket-2');

      const nonExistentPartner = yield* game.getPartner('socket-999');
      expect(nonExistentPartner).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );
});
