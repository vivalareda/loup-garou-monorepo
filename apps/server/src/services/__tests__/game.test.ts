import { describe, expect, it } from '@effect/vitest';
import type { Role } from '@repo/types';
import { Effect, Layer } from 'effect';
import { PlayerNotFoundError, SpecialPlayerNotFoundError } from '../errors.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const playerSocketIds = playerNames.map((_, index) => `socket-${index + 1}`);

const baseCounts: Record<Role, number> = {
  VILLAGER: 0,
  WEREWOLF: 0,
  SEER: 0,
  HUNTER: 0,
  CUPID: 0,
  WITCH: 0,
};

const countRoles = (roles: Role[]): Record<Role, number> => {
  const counts = { ...baseCounts };
  for (const role of roles) {
    counts[role] += 1;
  }
  return counts;
};

const makeTestLayer = () => {
  const configLayer = LobbyConfig.Live;
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );

  return Layer.mergeAll(lobbyLayer, gameLayer);
};

const setupGame = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;

  for (const [index, name] of playerNames.entries()) {
    yield* lobby.addPlayer(name, playerSocketIds[index]);
  }

  yield* game.startGame;

  const players = yield* game.getPlayers;

  return { game, players };
});

describe('Game Service', () => {
  it.effect('starts game with lobby players and assigns roles', () =>
    Effect.gen(function* () {
      const { players } = yield* setupGame;

      expect(players).toHaveLength(playerNames.length);
      expect(players.map((player) => player.getName())).toEqual(playerNames);
      expect(players.map((player) => player.getSocketId())).toEqual(
        playerSocketIds
      );

      const roleCounts = countRoles(players.map((player) => player.getRole()));

      expect(roleCounts).toEqual({
        ...baseCounts,
        WEREWOLF: 2,
        CUPID: 1,
        WITCH: 1,
        VILLAGER: 2,
      });
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns client player list identities', () =>
    Effect.gen(function* () {
      const { game } = yield* setupGame;

      const clientPlayers = yield* game.getClientPlayerList;

      expect(clientPlayers).toEqual(
        playerNames.map((name, index) => ({
          name,
          sid: playerSocketIds[index],
        }))
      );
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns special role players and errors when missing', () =>
    Effect.gen(function* () {
      const { game, players } = yield* setupGame;

      const cupid = players.find((player) => player.getRole() === 'CUPID');
      const witch = players.find((player) => player.getRole() === 'WITCH');

      expect(cupid).toBeDefined();
      expect(witch).toBeDefined();

      const cupidPlayer = yield* game.getSpecialRolePlayer('CUPID');
      const witchPlayer = yield* game.getSpecialRolePlayer('WITCH');

      expect(cupidPlayer.getSocketId()).toBe(cupid?.getSocketId());
      expect(witchPlayer.getSocketId()).toBe(witch?.getSocketId());

      const error = yield* game
        .getSpecialRolePlayer('HUNTER')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(SpecialPlayerNotFoundError);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns player by socket id and errors when missing', () =>
    Effect.gen(function* () {
      const { game } = yield* setupGame;

      const player = yield* game.getPlayerBySocketId(playerSocketIds[0]);

      expect(player.getName()).toBe(playerNames[0]);

      const error = yield* game
        .getPlayerBySocketId('missing-socket')
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(PlayerNotFoundError);
    }).pipe(Effect.provide(makeTestLayer()))
  );
});
