import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { PlayerNotFoundError } from '../errors.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

describe('Lovers (Game Service)', () => {
  const LobbyTest = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(Layer.succeed(LobbyConfig, { maxPlayers: 8 }))
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
      expect(yield* game.getLovers()).toBeNull();
      expect(yield* game.isPlayerLover('hunter-1')).toBe(false);

      yield* game.setLovers('hunter-1', 'lover-2');

      const hunterPartner = yield* game.getPartner('hunter-1');
      const partnerPartner = yield* game.getPartner('lover-2');
      const lovers = yield* game.getLovers();

      expect(hunterPartner?.getSocketId()).toBe('lover-2');
      expect(partnerPartner?.getSocketId()).toBe('hunter-1');
      expect(lovers?.[0].getSocketId()).toBe('hunter-1');
      expect(lovers?.[1].getSocketId()).toBe('lover-2');
      expect(yield* game.isPlayerLover('hunter-1')).toBe(true);
      expect(yield* game.isPlayerLover('lover-2')).toBe(true);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('setLovers fails for missing players', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Only Player', 'socket-1');
      yield* game.startGame;

      const error = yield* game
        .setLovers('socket-1', 'missing-socket')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(PlayerNotFoundError);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('isAnyLoverHunter returns true when hunter is a lover', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      for (let index = 1; index <= 8; index += 1) {
        yield* lobby.addPlayer(`Player ${index}`, `socket-${index}`);
      }

      yield* game.startGame;

      expect(yield* game.isAnyLoverHunter()).toBe(false);

      const players = yield* game.getPlayers;
      const hunterPlayer = players.find(
        (player) => player.getRole() === 'HUNTER'
      );
      const partnerPlayer = players.find(
        (player) => player.getSocketId() !== hunterPlayer?.getSocketId()
      );

      if (!(hunterPlayer && partnerPlayer)) {
        throw new Error('Expected hunter and partner to be defined');
      }

      yield* game.setLovers(
        hunterPlayer.getSocketId(),
        partnerPlayer.getSocketId()
      );

      expect(yield* game.isAnyLoverHunter()).toBe(true);
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('getPartner returns null for non-lovers', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Alice', 'socket-1');
      yield* lobby.addPlayer('Bob', 'socket-2');
      yield* lobby.addPlayer('Charlie', 'socket-3');
      yield* game.startGame;

      yield* game.setLovers('socket-1', 'socket-2');

      const nonLoverPartner = yield* game.getPartner('socket-3');
      const nonExistentPartner = yield* game.getPartner('socket-999');
      expect(nonLoverPartner).toBeNull();
      expect(nonExistentPartner).toBeNull();
    }).pipe(Effect.provide(TestLayer))
  );

  it.effect('adds partner suicide when lover dies', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;

      yield* lobby.addPlayer('Lover One', 'lover-1');
      yield* lobby.addPlayer('Lover Two', 'lover-2');
      yield* lobby.addPlayer('Bystander', 'bystander-3');
      yield* lobby.addPlayer('Bystander Two', 'bystander-4');
      yield* game.startGame;

      const players = yield* game.getPlayers;
      const loverOne = players.find(
        (player) => player.getSocketId() === 'lover-1'
      );
      const loverTwo = players.find(
        (player) => player.getSocketId() === 'lover-2'
      );

      if (!(loverOne && loverTwo)) {
        throw new Error('Expected lovers to be defined');
      }

      yield* game.setLovers(loverOne.getSocketId(), loverTwo.getSocketId());
      yield* game.addPendingDeath(loverOne.getSocketId(), 'WEREWOLVES');

      const deaths = yield* game.processPendingDeaths;
      const partnerDeath = deaths.find(
        (death) => death.cause === 'PARTNER_SUICIDE'
      );

      expect(deaths).toHaveLength(2);
      expect(partnerDeath?.metadata?.loverId).toBe(loverOne.getSocketId());
      expect(loverOne.isAlive).toBe(false);
      expect(loverTwo.isAlive).toBe(false);
    }).pipe(Effect.provide(TestLayer))
  );
});
