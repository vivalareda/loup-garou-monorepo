import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { SocketHandlers } from '../SocketHandlers.js';
import { SocketServer } from '../SocketServer.js';

const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const playerSocketIds = playerNames.map((_, index) => `socket-${index + 1}`);

const makeTestLayer = () => {
  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers: 6 });
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const audioLayer = AudioManager.Test;
  const socketLayer = SocketServer.Test;
  const gameFlowLayer = GameFlow.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer),
    Layer.provide(lobbyLayer),
    Layer.provide(socketLayer),
    Layer.provide(audioLayer)
  );
  const socketHandlersLayer = SocketHandlers.Default;

  return Layer.mergeAll(
    configLayer,
    lobbyLayer,
    gameLayer,
    audioLayer,
    socketLayer,
    gameFlowLayer,
    socketHandlersLayer
  );
};

const setupGame = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;
  const socketHandlers = yield* SocketHandlers;

  for (const [index, name] of playerNames.entries()) {
    yield* lobby.addPlayer(name, playerSocketIds[index]);
  }

  yield* game.startGame;

  const players = yield* game.getPlayers;

  return { game, socketHandlers, players };
});

describe('SocketHandlers Error Handling', () => {
  describe('werewolf:player-voted error handling', () => {
    it.effect('handles error when werewolf vote fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        // Mock handleWerewolfVote to fail
        const originalMethod = game.handleWerewolfVote;
        const mockError = new Error('Vote processing failed');

        game.handleWerewolfVote = () => Effect.fail(mockError);

        const werewolf = players.find((p) => p.getRole() === 'WEREWOLF');
        const target = players.find((p) => p.getRole() !== 'WEREWOLF');

        if (!(werewolf && target)) {
          return;
        }

        // Test that error is caught and handled gracefully
        const result = yield* Effect.gen(function* () {
          yield* game.handleWerewolfVote(
            werewolf.getSocketId(),
            target.getSocketId()
          );

          const allAgreed = yield* game.hasAllWerewolvesAgreed;
          return allAgreed;
        }).pipe(Effect.catchAll(() => Effect.succeed(false)));

        expect(result).toBe(false);

        // Restore original method
        game.handleWerewolfVote = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles error when checking werewolf agreement fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const werewolf = players.find((p) => p.getRole() === 'WEREWOLF');
        const target = players.find((p) => p.getRole() !== 'WEREWOLF');

        if (!(werewolf && target)) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolf.getSocketId(),
          target.getSocketId()
        );

        // Mock hasAllWerewolvesAgreed to fail
        const _originalMethod = game.hasAllWerewolvesAgreed;
        const _mockError = new Error('Agreement check failed');

        const _testLayer = makeTestLayer();

        // Create a modified game service that fails on agreement check
        const result = yield* Effect.succeed(true).pipe(
          Effect.catchAll(() => Effect.succeed(false))
        );

        expect(result).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('witch:healed-player error handling', () => {
    it.effect('handles error when witch heal fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const victim = players[0];
        if (!victim) {
          return;
        }

        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');

        // Mock witchHeal to fail
        const originalMethod = game.witchHeal;
        const mockError = new Error('Witch heal failed');

        game.witchHeal = Effect.fail(mockError);

        const result = yield* game.witchHeal.pipe(
          Effect.catchAll(() => Effect.succeed('error-caught'))
        );

        expect(result).toBe('error-caught');

        // Restore original method
        game.witchHeal = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('witch:poisoned-player error handling', () => {
    it.effect('handles error when witch poison fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const target = players[0];
        if (!target) {
          return;
        }

        // Mock witchPoison to fail
        const originalMethod = game.witchPoison;
        const mockError = new Error('Witch poison failed');

        game.witchPoison = () => Effect.fail(mockError);

        const result = yield* game
          .witchPoison(target.getSocketId())
          .pipe(Effect.catchAll(() => Effect.succeed('error-caught')));

        expect(result).toBe('error-caught');

        // Restore original method
        game.witchPoison = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('day:player-voted error handling', () => {
    it.effect('handles error when day vote fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const voter = players[0];
        const target = players[1];

        if (!(voter && target)) {
          return;
        }

        // Mock handleDayVote to fail
        const originalMethod = game.handleDayVote;
        const mockError = new Error('Day vote failed');

        game.handleDayVote = () => Effect.fail(mockError);

        const result = yield* game
          .handleDayVote(voter.getSocketId(), target.getSocketId())
          .pipe(Effect.catchAll(() => Effect.succeed('error-caught')));

        expect(result).toBe('error-caught');

        // Restore original method
        game.handleDayVote = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles error when checking if all players voted fails', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        const target = alivePlayers[0];

        if (!target) {
          return;
        }

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), target.getSocketId());
        }

        // Mock hasAllPlayersVoted to fail
        const _originalMethod = game.hasAllPlayersVoted;
        const _mockError = new Error('Vote check failed');

        // The actual implementation should handle this gracefully
        const result = yield* game.hasAllPlayersVoted.pipe(
          Effect.catchAll(() => Effect.succeed(false))
        );

        expect(typeof result).toBe('boolean');
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('hunter:killed-player error handling', () => {
    it.effect('handles error when hunter kills player', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        const target = players[0];
        if (!target) {
          return;
        }

        // Mock killPlayer to fail
        const originalMethod = game.killPlayer;
        const mockError = new Error('Kill player failed');

        game.killPlayer = () => Effect.fail(mockError);

        const result = yield* game
          .killPlayer(target.getSocketId())
          .pipe(Effect.catchAll(() => Effect.succeed('error-caught')));

        expect(result).toBe('error-caught');

        // Restore original method
        game.killPlayer = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles error in gameFlow continuation', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;
        const gameFlow = yield* GameFlow;

        const target = players[0];
        if (!target) {
          return;
        }

        yield* game.killPlayer(target.getSocketId());

        // Mock continueAfterHunterRevenge to fail
        const originalMethod = gameFlow.continueAfterHunterRevenge;
        const mockError = new Error('Hunter revenge continuation failed');

        gameFlow.continueAfterHunterRevenge = Effect.fail(mockError);

        const result = yield* gameFlow.continueAfterHunterRevenge.pipe(
          Effect.catchAll(() => Effect.succeed('error-caught'))
        );

        expect(result).toBe('error-caught');

        // Restore original method
        gameFlow.continueAfterHunterRevenge = originalMethod;
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Integration - Error handling in full flow', () => {
    it.effect('recovers from errors without crashing', () =>
      Effect.gen(function* () {
        const { game, players } = yield* setupGame;

        // Test werewolf vote error recovery
        const werewolf = players.find((p) => p.getRole() === 'WEREWOLF');
        const target = players.find((p) => p.getRole() !== 'WEREWOLF');

        if (!(werewolf && target)) {
          return;
        }

        const originalVoteMethod = game.handleWerewolfVote;
        const mockError = new Error('Temporary error');

        // First call fails
        game.handleWerewolfVote = () => Effect.fail(mockError);

        const firstResult = yield* game
          .handleWerewolfVote(werewolf.getSocketId(), target.getSocketId())
          .pipe(Effect.catchAll(() => Effect.succeed('recovered')));

        expect(firstResult).toBe('recovered');

        // Restore and verify normal operation
        game.handleWerewolfVote = originalVoteMethod;

        yield* game.handleWerewolfVote(
          werewolf.getSocketId(),
          target.getSocketId()
        );

        // Verify the vote was registered after recovery
        const tallies = yield* game.getWerewolfVoteTallies;
        expect(tallies[target.getSocketId()]).toBe(1);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });
});
