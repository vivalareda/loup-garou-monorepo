import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

const makeTestLayer = (maxPlayers: number) => {
  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers });
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );

  return Layer.mergeAll(lobbyLayer, gameLayer);
};

const createPlayers = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    name: `Player ${index + 1}`,
    sid: `socket-${index + 1}`,
  }));

const setupGame = (playerCount: number) =>
  Effect.gen(function* () {
    const lobby = yield* Lobby;
    const game = yield* Game;
    const players = createPlayers(playerCount);

    for (const player of players) {
      yield* lobby.addPlayer(player.name, player.sid);
    }

    yield* game.startGame;

    return { game, players: yield* game.getPlayers };
  });

describe('Death processing (Game Service)', () => {
  it.effect('processes a single pending death', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame(4);
      const target = players[0];

      if (!target) {
        throw new Error('Expected player to be defined');
      }

      yield* game.addPendingDeath(target.getSocketId(), 'WEREWOLVES');

      const deaths = yield* game.processPendingDeaths;

      expect(deaths).toHaveLength(1);
      expect(deaths[0]?.playerId).toBe(target.getSocketId());
      expect(target.isAlive).toBe(false);
      expect(yield* game.isInDeathQueue(target.getSocketId())).toBe(false);
    }).pipe(Effect.provide(makeTestLayer(4)))
  );

  it.effect('adds partner suicides in a second pass', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame(4);
      const loverOne = players[0];
      const loverTwo = players[1];

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
    }).pipe(Effect.provide(makeTestLayer(4)))
  );

  it.effect('detects when the hunter is in the death queue', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame(8);
      const hunter = players.find((player) => player.getRole() === 'HUNTER');

      if (!hunter) {
        throw new Error('Expected hunter to be assigned');
      }

      yield* game.addPendingDeath(hunter.getSocketId(), 'DAY_VOTE');

      expect(yield* game.hunterIsInDeathQueue).toBe(true);
    }).pipe(Effect.provide(makeTestLayer(8)))
  );

  it.effect('marks a witch death in the pending list', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame(6);
      const witch = players.find((player) => player.getRole() === 'WITCH');

      if (!witch) {
        throw new Error('Expected witch to be assigned');
      }

      yield* game.addPendingDeath(witch.getSocketId(), 'WITCH_POISON');

      const deaths = yield* game.processPendingDeaths;
      const witchDeath = deaths.find(
        (death) => death.playerId === witch.getSocketId()
      );

      expect(witchDeath?.cause).toBe('WITCH_POISON');
      expect(witch.isAlive).toBe(false);
    }).pipe(Effect.provide(makeTestLayer(6)))
  );

  it.effect('handles multiple pending deaths in one pass', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame(6);
      const [first, second] = players;

      if (!(first && second)) {
        throw new Error('Expected players to be defined');
      }

      yield* game.addPendingDeath(first.getSocketId(), 'WEREWOLVES');
      yield* game.addPendingDeath(second.getSocketId(), 'DAY_VOTE');

      const deaths = yield* game.processPendingDeaths;

      expect(deaths).toHaveLength(2);
      expect(first.isAlive).toBe(false);
      expect(second.isAlive).toBe(false);
      expect(yield* game.isInDeathQueue(first.getSocketId())).toBe(false);
      expect(yield* game.isInDeathQueue(second.getSocketId())).toBe(false);
    }).pipe(Effect.provide(makeTestLayer(6)))
  );
});
