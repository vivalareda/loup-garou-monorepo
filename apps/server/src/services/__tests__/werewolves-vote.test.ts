import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { PlayerNotWerewolfError } from '../errors.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { WerewolvesVote } from '../WerewolvesVote.js';

const makeTestLayer = () => {
  const configLayer = LobbyConfig.Live;
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const werewolvesVoteLayer = WerewolvesVote.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer)
  );
  return Layer.mergeAll(lobbyLayer, gameLayer, werewolvesVoteLayer);
};

describe('WerewolvesVote Service', () => {
  it.effect('registers werewolf vote successfully', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(1);

      const victim = players.find((p) => p.getRole() !== 'WEREWOLF');
      expect(victim).toBeDefined();

      if (!victim) {
        return;
      }

      const result = yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victim.getSocketId()
      );

      expect(result).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns target when all werewolves vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(2);

      const victim = players.find((p) => p.getRole() !== 'WEREWOLF');
      expect(victim).toBeDefined();

      if (!victim) {
        return;
      }

      let finalResult: string | boolean = false;
      for (const wolf of werewolves) {
        const result = yield* werewolvesVote.registerWerewolfVote(
          wolf.getSocketId(),
          victim.getSocketId()
        );
        if (typeof result === 'string') {
          finalResult = result;
        }
      }

      expect(finalResult).toBe(victim.getSocketId());
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns false when werewolves disagree on vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(2);

      const victims = players.filter((p) => p.getRole() !== 'WEREWOLF');
      expect(victims.length).toBeGreaterThanOrEqual(2);

      yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victims[0].getSocketId()
      );

      const result = yield* werewolvesVote.registerWerewolfVote(
        werewolves[1].getSocketId(),
        victims[1].getSocketId()
      );

      expect(result).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('fails when non-werewolf tries to vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(1);

      const villager = players.find((p) => p.getRole() === 'VILLAGER');
      expect(villager).toBeDefined();

      if (!villager) {
        return;
      }

      const error = yield* werewolvesVote
        .registerWerewolfVote(
          villager.getSocketId(),
          werewolves[0].getSocketId()
        )
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(PlayerNotWerewolfError);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('calculates vote tallies correctly', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(2);

      const victims = players.filter((p) => p.getRole() !== 'WEREWOLF');
      expect(victims.length).toBeGreaterThanOrEqual(1);

      for (const wolf of werewolves) {
        yield* werewolvesVote.registerWerewolfVote(
          wolf.getSocketId(),
          victims[0].getSocketId()
        );
      }

      const tallies = yield* werewolvesVote.getVotes;

      expect(tallies[victims[0].getName()]).toBe(werewolves.length);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('clears votes after clear is called', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      for (let i = 1; i <= 6; i++) {
        yield* lobby.addPlayer(`Player${i}`, `socket-${i}`);
      }

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const players = yield* game.getPlayers;

      expect(werewolves.length).toBeGreaterThanOrEqual(1);

      const victim = players.find((p) => p.getRole() !== 'WEREWOLF');
      expect(victim).toBeDefined();

      if (!victim) {
        return;
      }

      for (const wolf of werewolves) {
        yield* werewolvesVote.registerWerewolfVote(
          wolf.getSocketId(),
          victim.getSocketId()
        );
      }

      yield* werewolvesVote.clear;

      const tallies = yield* werewolvesVote.getVotes;

      expect(tallies).toEqual({});
    }).pipe(Effect.provide(makeTestLayer()))
  );
});
