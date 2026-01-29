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

      yield* lobby.addPlayer('Wolf1', 'wolf-1-socket');
      yield* lobby.addPlayer('Wolf2', 'wolf-2-socket');
      yield* lobby.addPlayer('Victim', 'victim-socket');

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const victim = yield* game.getPlayerBySocketId('victim-socket');

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

      yield* lobby.addPlayer('Wolf1', 'wolf-1-socket');
      yield* lobby.addPlayer('Wolf2', 'wolf-2-socket');
      yield* lobby.addPlayer('Victim', 'victim-socket');

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const victim = yield* game.getPlayerBySocketId('victim-socket');

      yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victim.getSocketId()
      );
      const result = yield* werewolvesVote.registerWerewolfVote(
        werewolves[1].getSocketId(),
        victim.getSocketId()
      );

      expect(result).toBe('victim-socket');
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns false when werewolves disagree on vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      yield* lobby.addPlayer('Wolf1', 'wolf-1-socket');
      yield* lobby.addPlayer('Wolf2', 'wolf-2-socket');
      yield* lobby.addPlayer('Victim1', 'victim-1-socket');
      yield* lobby.addPlayer('Victim2', 'victim-2-socket');

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const victim1 = yield* game.getPlayerBySocketId('victim-1-socket');
      const victim2 = yield* game.getPlayerBySocketId('victim-2-socket');

      yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victim1.getSocketId()
      );
      const result = yield* werewolvesVote.registerWerewolfVote(
        werewolves[1].getSocketId(),
        victim2.getSocketId()
      );

      expect(result).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('fails when non-werewolf tries to vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      yield* lobby.addPlayer('Wolf', 'wolf-socket');
      yield* lobby.addPlayer('Villager', 'villager-socket');

      yield* game.startGame;

      const victim = yield* game.getPlayerBySocketId('wolf-socket');
      const villager = yield* game.getPlayerBySocketId('villager-socket');

      const error = yield* werewolvesVote
        .registerWerewolfVote(villager.getSocketId(), victim.getSocketId())
        .pipe(Effect.flip);

      expect(error).toBeInstanceOf(PlayerNotWerewolfError);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('calculates vote tallies correctly', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      yield* lobby.addPlayer('Wolf1', 'wolf-1-socket');
      yield* lobby.addPlayer('Wolf2', 'wolf-2-socket');
      yield* lobby.addPlayer('Wolf3', 'wolf-3-socket');
      yield* lobby.addPlayer('Victim1', 'victim-1-socket');
      yield* lobby.addPlayer('Victim2', 'victim-2-socket');

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const victim1 = yield* game.getPlayerBySocketId('victim-1-socket');
      const victim2 = yield* game.getPlayerBySocketId('victim-2-socket');

      yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victim1.getSocketId()
      );
      yield* werewolvesVote.registerWerewolfVote(
        werewolves[1].getSocketId(),
        victim1.getSocketId()
      );
      yield* werewolvesVote.registerWerewolfVote(
        werewolves[2].getSocketId(),
        victim2.getSocketId()
      );

      const tallies = yield* werewolvesVote.getVotes;

      expect(tallies).toEqual({
        Victim1: 2,
        Victim2: 1,
      });
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('clears votes after clear is called', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const werewolvesVote = yield* WerewolvesVote;

      yield* lobby.addPlayer('Wolf1', 'wolf-1-socket');
      yield* lobby.addPlayer('Wolf2', 'wolf-2-socket');
      yield* lobby.addPlayer('Victim', 'victim-socket');

      yield* game.startGame;

      const werewolves = yield* game.getWerewolves;
      const victim = yield* game.getPlayerBySocketId('victim-socket');

      yield* werewolvesVote.registerWerewolfVote(
        werewolves[0].getSocketId(),
        victim.getSocketId()
      );
      yield* werewolvesVote.registerWerewolfVote(
        werewolves[1].getSocketId(),
        victim.getSocketId()
      );

      yield* werewolvesVote.clear;

      const tallies = yield* werewolvesVote.getVotes;

      expect(tallies).toEqual({});
    }).pipe(Effect.provide(makeTestLayer()))
  );
});
