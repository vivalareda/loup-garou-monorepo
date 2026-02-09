import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { DayVote } from '../DayVote.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';

const makeTestLayer = () => {
  const configLayer = LobbyConfig.Live;
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const dayVoteLayer = DayVote.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer)
  );

  return Layer.mergeAll(lobbyLayer, gameLayer, dayVoteLayer);
};

describe('DayVote Service', () => {
  it.effect('registers day vote successfully', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');
      yield* lobby.addPlayer('Player4', 'player-4-socket');
      yield* lobby.addPlayer('Player5', 'player-5-socket');
      yield* lobby.addPlayer('Player6', 'player-6-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const victim = players[3];

      const result = yield* dayVote.registerVote(
        players[0].getSocketId(),
        victim.getSocketId()
      );

      expect(result).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns target when majority is reached', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');
      yield* lobby.addPlayer('Player4', 'player-4-socket');
      yield* lobby.addPlayer('Player5', 'player-5-socket');
      yield* lobby.addPlayer('Player6', 'player-6-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const victim = players[4];

      // Need ALL 6 players to vote for majority to be checked
      yield* dayVote.registerVote(
        players[0].getSocketId(),
        victim.getSocketId()
      );
      yield* dayVote.registerVote(
        players[1].getSocketId(),
        victim.getSocketId()
      );
      yield* dayVote.registerVote(
        players[2].getSocketId(),
        victim.getSocketId()
      );
      yield* dayVote.registerVote(
        players[3].getSocketId(),
        victim.getSocketId()
      );
      yield* dayVote.registerVote(
        players[4].getSocketId(),
        victim.getSocketId()
      );
      // 6th vote triggers majority check
      const result = yield* dayVote.registerVote(
        players[5].getSocketId(),
        victim.getSocketId()
      );

      expect(result).toEqual({
        result: 'MajorityVote',
        victim: victim.getSocketId(),
      });
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('returns tie outcome when votes are tied', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');
      yield* lobby.addPlayer('Player4', 'player-4-socket');
      yield* lobby.addPlayer('Player5', 'player-5-socket');
      yield* lobby.addPlayer('Player6', 'player-6-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const victim1 = players[4];
      const victim2 = players[5];

      // Split votes 3-3, no majority (needs 4 votes with 6 players)
      yield* dayVote.registerVote(
        players[0].getSocketId(),
        victim1.getSocketId()
      );
      yield* dayVote.registerVote(
        players[1].getSocketId(),
        victim1.getSocketId()
      );
      yield* dayVote.registerVote(
        players[2].getSocketId(),
        victim1.getSocketId()
      );
      yield* dayVote.registerVote(
        players[3].getSocketId(),
        victim2.getSocketId()
      );
      yield* dayVote.registerVote(
        players[4].getSocketId(),
        victim2.getSocketId()
      );
      // 6th vote triggers majority check
      const result = yield* dayVote.registerVote(
        players[5].getSocketId(),
        victim2.getSocketId()
      );

      expect(result).toEqual({
        result: 'Tie',
        tiedPlayers: [victim1.getSocketId(), victim2.getSocketId()],
      });
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('dead players cannot vote', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const deadPlayer = players[0];
      const victim = players[1];

      deadPlayer.kill();

      const result = yield* dayVote.registerVote(
        deadPlayer.getSocketId(),
        victim.getSocketId()
      );

      expect(result).toBe(false);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('calculates vote tallies correctly', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');
      yield* lobby.addPlayer('Player4', 'player-4-socket');
      yield* lobby.addPlayer('Player5', 'player-5-socket');
      yield* lobby.addPlayer('Player6', 'player-6-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const victim1 = players[4];
      const victim2 = players[5];

      yield* dayVote.registerVote(
        players[0].getSocketId(),
        victim1.getSocketId()
      );
      yield* dayVote.registerVote(
        players[1].getSocketId(),
        victim1.getSocketId()
      );
      yield* dayVote.registerVote(
        players[2].getSocketId(),
        victim2.getSocketId()
      );

      const tallies = yield* dayVote.getVotes;

      expect(tallies[victim1.getName()]).toBe(2);
      expect(tallies[victim2.getName()]).toBe(1);
    }).pipe(Effect.provide(makeTestLayer()))
  );

  it.effect('clears votes after clear is called', () =>
    Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const dayVote = yield* DayVote;

      yield* lobby.addPlayer('Player1', 'player-1-socket');
      yield* lobby.addPlayer('Player2', 'player-2-socket');
      yield* lobby.addPlayer('Player3', 'player-3-socket');

      yield* game.startGame;

      const players = yield* game.getPlayers;
      const victim = players[2];

      yield* dayVote.registerVote(
        players[0].getSocketId(),
        victim.getSocketId()
      );
      yield* dayVote.registerVote(
        players[1].getSocketId(),
        victim.getSocketId()
      );

      yield* dayVote.clear;

      const tallies = yield* dayVote.getVotes;

      expect(tallies).toEqual({});
    }).pipe(Effect.provide(makeTestLayer()))
  );
});
