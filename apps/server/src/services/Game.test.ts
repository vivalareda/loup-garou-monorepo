import { describe, expect } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { Game } from './Game.js';
import { DeathManager } from './DeathManager.js';

const TestLayer = Layer.merge(DeathManager.Default, Game.Default);

describe('Game - Werewolf Voting', () => {
  describe('handleWerewolfVote', () => {
    it.effect('should allow werewolf to vote for a valid target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && villager)) {
          return;
        }

        const result = yield* Effect.either(
          game.handleWerewolfVote(werewolf.socketId, villager.socketId)
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reject vote from non-werewolf player', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const villager = players.find((p) => p.role === 'VILLAGER');
        const anotherVillager = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager?.socketId
        );

        if (!(villager && anotherVillager)) {
          return;
        }

        const result = yield* Effect.either(
          game.handleWerewolfVote(villager.socketId, anotherVillager.socketId)
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('not a werewolf');
        }
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should allow vote updates from werewolf', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager1 = players.find((p) => p.role === 'VILLAGER');
        const villager2 = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager1?.socketId
        );

        if (!(werewolf && villager1 && villager2)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf.socketId, villager1.socketId);
        const result = yield* Effect.either(
          game.handleWerewolfUpdateVote(
            werewolf.socketId,
            villager2.socketId,
            villager1.socketId
          )
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reject vote update from non-werewolf', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const villager = players.find((p) => p.role === 'VILLAGER');
        const anotherVillager = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager?.socketId
        );

        if (!(villager && anotherVillager)) {
          return;
        }

        const result = yield* Effect.either(
          game.handleWerewolfUpdateVote(
            villager.socketId,
            anotherVillager.socketId,
            anotherVillager.socketId
          )
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reject vote update with wrong old vote', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager1 = players.find((p) => p.role === 'VILLAGER');
        const villager2 = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager1?.socketId
        );
        const villager3 = players.find(
          (p) =>
            p.role === 'VILLAGER' &&
            p.socketId !== villager1?.socketId &&
            p.socketId !== villager2?.socketId
        );

        if (!(werewolf && villager1 && villager2 && villager3)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf.socketId, villager1.socketId);
        const result = yield* Effect.either(
          game.handleWerewolfUpdateVote(
            werewolf.socketId,
            villager2.socketId,
            villager3.socketId
          )
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('Vote mismatch');
        }
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reject vote update for werewolf target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf1 = players.find((p) => p.role === 'WEREWOLF');
        const werewolf2 = players.find(
          (p) => p.role === 'WEREWOLF' && p.socketId !== werewolf1?.socketId
        );
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf1 && werewolf2 && villager)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf1.socketId, villager.socketId);
        const result = yield* Effect.either(
          game.handleWerewolfUpdateVote(
            werewolf1.socketId,
            werewolf2.socketId,
            villager.socketId
          )
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('not a valid target');
        }
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('getWerewolfVoteTallies', () => {
    it.effect('should return empty tallies when no votes', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const tallies = yield* game.getWerewolfVoteTallies;

        expect(tallies).toEqual({});
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should correctly count single vote', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && villager)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf.socketId, villager.socketId);
        const tallies = yield* game.getWerewolfVoteTallies;

        expect(tallies[villager.socketId]).toBe(1);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should correctly count multiple votes for same target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || !villager) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villager.socketId
        );
        yield* game.handleWerewolfVote(
          werewolves[1].socketId,
          villager.socketId
        );
        const tallies = yield* game.getWerewolfVoteTallies;

        expect(tallies[villager.socketId]).toBe(2);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should correctly count votes for different targets', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villagers[0].socketId
        );
        yield* game.handleWerewolfVote(
          werewolves[1].socketId,
          villagers[1].socketId
        );
        const tallies = yield* game.getWerewolfVoteTallies;

        expect(tallies[villagers[0].socketId]).toBe(1);
        expect(tallies[villagers[1].socketId]).toBe(1);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reflect vote updates in tallies', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager1 = players.find((p) => p.role === 'VILLAGER');
        const villager2 = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager1?.socketId
        );

        if (!(werewolf && villager1 && villager2)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf.socketId, villager1.socketId);
        yield* game.handleWerewolfUpdateVote(
          werewolf.socketId,
          villager2.socketId,
          villager1.socketId
        );

        const tallies = yield* game.getWerewolfVoteTallies;

        expect(tallies[villager1.socketId]).toBeUndefined();
        expect(tallies[villager2.socketId]).toBe(1);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('hasAllWerewolvesAgreed', () => {
    it.effect('should return false when no votes cast', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const agreed = yield* game.hasAllWerewolvesAgreed;

        expect(agreed).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when not all werewolves have voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || !villager) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villager.socketId
        );

        const agreed = yield* game.hasAllWerewolvesAgreed;

        expect(agreed).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when votes are not unanimous', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villagers[0].socketId
        );
        yield* game.handleWerewolfVote(
          werewolves[1].socketId,
          villagers[1].socketId
        );

        const agreed = yield* game.hasAllWerewolvesAgreed;

        expect(agreed).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return true when all werewolves agree on target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || !villager) {
          return;
        }

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(werewolf.socketId, villager.socketId);
        }

        const agreed = yield* game.hasAllWerewolvesAgreed;

        expect(agreed).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle single werewolf correctly', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && villager)) {
          return;
        }

        yield* game.handleWerewolfVote(werewolf.socketId, villager.socketId);

        const agreed = yield* game.hasAllWerewolvesAgreed;

        expect(agreed).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('getWerewolfTarget', () => {
    it.effect('should return null when no votes cast', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const target = yield* game.getWerewolfTarget;

        expect(target).toBe(null);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return null when not all werewolves have voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || !villager) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villager.socketId
        );

        const target = yield* game.getWerewolfTarget;

        expect(target).toBe(null);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return null when votes are not unanimous', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        yield* game.handleWerewolfVote(
          werewolves[0].socketId,
          villagers[0].socketId
        );
        yield* game.handleWerewolfVote(
          werewolves[1].socketId,
          villagers[1].socketId
        );

        const target = yield* game.getWerewolfTarget;

        expect(target).toBe(null);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return target when all werewolves agree', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || !villager) {
          return;
        }

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(werewolf.socketId, villager.socketId);
        }

        const target = yield* game.getWerewolfTarget;

        expect(target).toBe(villager.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reflect vote updates in target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(
            werewolf.socketId,
            villagers[0].socketId
          );
        }

        let target = yield* game.getWerewolfTarget;
        expect(target).toBe(villagers[0].socketId);

        yield* game.handleWerewolfUpdateVote(
          werewolves[0].socketId,
          villagers[1].socketId,
          villagers[0].socketId
        );

        target = yield* game.getWerewolfTarget;
        expect(target).toBe(null);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Werewolf Voting Integration', () => {
    it.effect('should handle complete voting sequence', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 1) {
          return;
        }

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(
            werewolf.socketId,
            villagers[0].socketId
          );
        }

        const tallies = yield* game.getWerewolfVoteTallies;
        const agreed = yield* game.hasAllWerewolvesAgreed;
        const target = yield* game.getWerewolfTarget;

        expect(tallies[villagers[0].socketId]).toBe(werewolves.length);
        expect(agreed).toBe(true);
        expect(target).toBe(villagers[0].socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle voting with updates', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        for (let i = 0; i < werewolves.length; i++) {
          const target = villagers[i % villagers.length];
          yield* game.handleWerewolfVote(
            werewolves[i].socketId,
            target.socketId
          );
        }

        let agreed = yield* game.hasAllWerewolvesAgreed;

        if (agreed) {
          return;
        }

        yield* game.handleWerewolfUpdateVote(
          werewolves[0].socketId,
          villagers[0].socketId,
          werewolves[0].role === 'WEREWOLF'
            ? werewolves[0].socketId
            : villagers[0].socketId
        );

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(
            werewolf.socketId,
            villagers[0].socketId
          );
        }

        agreed = yield* game.hasAllWerewolvesAgreed;
        const target = yield* game.getWerewolfTarget;

        expect(agreed).toBe(true);
        expect(target).toBe(villagers[0].socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle multiple voting cycles', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const werewolves = players.filter((p) => p.role === 'WEREWOLF');
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 1 || villagers.length < 2) {
          return;
        }

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfVote(
            werewolf.socketId,
            villagers[0].socketId
          );
        }

        let target = yield* game.getWerewolfTarget;
        expect(target).toBe(villagers[0].socketId);

        for (const werewolf of werewolves) {
          yield* game.handleWerewolfUpdateVote(
            werewolf.socketId,
            villagers[1].socketId,
            villagers[0].socketId
          );
        }

        target = yield* game.getWerewolfTarget;
        expect(target).toBe(villagers[1].socketId);
      }).pipe(Effect.provide(TestLayer))
    );
  });
});

describe('Game - Day Voting', () => {
  describe('handleDayVote', () => {
    it.effect('should allow player to vote for a valid target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const voter = players.find((p) => p.isAlive);
        const target = players.find(
          (p) => p.socketId !== voter?.socketId && p.isAlive
        );

        if (!(voter && target)) {
          return;
        }

        yield* game.handleDayVote(voter.socketId, target.socketId);

        const tallies = yield* game.calculateDayVoteTallies;
        expect(tallies[target.socketId]).toBe(1);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should overwrite previous vote from same player', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const voter = players.find((p) => p.isAlive);
        const target1 = players.find(
          (p) => p.socketId !== voter?.socketId && p.isAlive
        );
        const target2 = players.find(
          (p) =>
            p.socketId !== voter?.socketId &&
            p.socketId !== target1?.socketId &&
            p.isAlive
        );

        if (!(voter && target1 && target2)) {
          return;
        }

        yield* game.handleDayVote(voter.socketId, target1.socketId);
        yield* game.handleDayVote(voter.socketId, target2.socketId);

        const tallies = yield* game.calculateDayVoteTallies;
        expect(tallies[target1.socketId]).toBeUndefined();
        expect(tallies[target2.socketId]).toBe(1);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('calculateDayVoteTallies', () => {
    it.effect('should correctly calculate vote tallies', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 3) {
          return;
        }

        yield* game.handleDayVote(
          alivePlayers[0].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[2].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[3]?.socketId || '',
          alivePlayers[1].socketId
        );

        const tallies = yield* game.calculateDayVoteTallies;
        expect(tallies[alivePlayers[1].socketId]).toBeGreaterThanOrEqual(2);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return empty object when no votes', () =>
      Effect.gen(function* () {
        const game = yield* Game;

        const tallies = yield* game.calculateDayVoteTallies;
        expect(tallies).toEqual({});
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('hasAllPlayersVoted', () => {
    it.effect('should return false when not all players have voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const allVoted = yield* game.hasAllPlayersVoted;
        expect(allVoted).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when some players have voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 2) {
          return;
        }

        yield* game.handleDayVote(
          alivePlayers[0].socketId,
          alivePlayers[1].socketId
        );

        const allVoted = yield* game.hasAllPlayersVoted;
        expect(allVoted).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return true when all alive players have voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 2) {
          return;
        }

        for (let i = 1; i < alivePlayers.length; i++) {
          yield* game.handleDayVote(
            alivePlayers[i].socketId,
            alivePlayers[0].socketId
          );
        }

        const allVoted = yield* game.hasAllPlayersVoted;
        expect(allVoted).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('getDayVoteTarget', () => {
    it.effect('should return null when no votes', () =>
      Effect.gen(function* () {
        const game = yield* Game;

        const target = yield* game.getDayVoteTarget;
        expect(target).toBeNull();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return target with most votes', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 3) {
          return;
        }

        yield* game.handleDayVote(
          alivePlayers[0].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[2].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[3]?.socketId || '',
          alivePlayers[2]?.socketId || ''
        );

        const target = yield* game.getDayVoteTarget;
        expect(target).toBe(alivePlayers[1].socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return null on tie', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 4) {
          return;
        }

        yield* game.handleDayVote(
          alivePlayers[0].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[2].socketId,
          alivePlayers[3].socketId
        );

        const target = yield* game.getDayVoteTarget;
        expect(target).toBeNull();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle three-way tie', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const alivePlayers = players.filter((p) => p.isAlive);
        if (alivePlayers.length < 6) {
          return;
        }

        yield* game.handleDayVote(
          alivePlayers[0].socketId,
          alivePlayers[1].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[2].socketId,
          alivePlayers[3].socketId
        );
        yield* game.handleDayVote(
          alivePlayers[4].socketId,
          alivePlayers[5].socketId
        );

        const target = yield* game.getDayVoteTarget;
        expect(target).toBeNull();
      }).pipe(Effect.provide(TestLayer))
    );
  });
});

describe('Game - Death Processing Workflow', () => {
  describe('processPendingDeaths', () => {
    it.effect('should process single werewolf victim death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && victim)) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');
        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
        expect(deaths[0].cause).toBe('WEREWOLVES');
        expect(deaths[0].playerName).toBe(victim.name);
        expect(victim.isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should process multiple deaths', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victims = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (victims.length < 2) {
          return;
        }

        yield* deathManager.addPendingDeath(victims[0], 'WEREWOLVES');
        yield* deathManager.addPendingDeath(victims[1], 'WITCH_POISON');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(2);
        expect(deaths[0].playerId).toBe(victims[0].socketId);
        expect(deaths[1].playerId).toBe(victims[1].socketId);
        expect(deaths[0].cause).toBe('WEREWOLVES');
        expect(deaths[1].cause).toBe('WITCH_POISON');
        expect(victims[0].isAlive).toBe(false);
        expect(victims[1].isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lover partner suicide cascade', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(2);
        expect(deaths.some((d) => d.playerId === lovers[0].socketId)).toBe(true);
        expect(deaths.some((d) => d.playerId === lovers[1].socketId)).toBe(true);
        expect(
          deaths.find((d) => d.playerId === lovers[1].socketId)?.cause
        ).toBe('PARTNER_SUICIDE');
        expect(lovers[0].isAlive).toBe(false);
        expect(lovers[1].isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should not cascade partner suicide if partner already dead', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        lovers[1].setIsAlive(false);

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(lovers[0].socketId);
        expect(lovers[0].isAlive).toBe(false);
        expect(lovers[1].isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should not cascade if death cause is PARTNER_SUICIDE', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        yield* deathManager.addPendingDeath(
          lovers[0],
          'PARTNER_SUICIDE'
        );

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(lovers[0].socketId);
        expect(lovers[1].isAlive).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should include metadata in death info', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addDayVoteElimination(victim.socketId, 5);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
        expect(deaths[0].cause).toBe('DAY_VOTE');
        expect(deaths[0].metadata?.voteCount).toBe(5);
        expect(deaths[0].timestamp).toBeInstanceOf(Date);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return empty array when no pending deaths', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toEqual([]);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail if player not found', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        yield* deathManager.addPartnerSuicide('nonexistent-sid', 'another-sid');

        const result = yield* Effect.either(game.processPendingDeaths);

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('not found');
        }
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should clear pending deaths after processing', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const remainingDeaths = yield* deathManager.getPendingDeaths;

        expect(remainingDeaths).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle day vote elimination', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addDayVoteElimination(victim.socketId, 7);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
        expect(deaths[0].cause).toBe('DAY_VOTE');
        expect(deaths[0].metadata?.voteCount).toBe(7);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle hunter revenge death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victim = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && victim)) {
          return;
        }

        yield* deathManager.addHunterRevenge(victim.socketId, hunter.socketId);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
        expect(deaths[0].cause).toBe('HUNTER_REVENGE');
        expect(deaths[0].metadata?.hunterId).toBe(hunter.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle witch poison death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addWitchPoison(victim.socketId);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
        expect(deaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should process death with all metadata types', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (!hunter || lovers.length < 2) {
          return;
        }

        yield* deathManager.addDayVoteElimination(lovers[0].socketId, 6);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(2);
        expect(deaths[0].metadata?.voteCount).toBe(6);
        expect(deaths[1].metadata?.loverId).toBe(lovers[0].socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should verify two-pass processing: cascade then all deaths', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);
        const hunter = players.find((p) => p.role === 'HUNTER');

        if (lovers.length < 2 || !hunter) {
          return;
        }

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');
        yield* deathManager.addPendingDeath(hunter, 'DAY_VOTE');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(3);
        expect(
          deaths.filter((d) => d.playerId === lovers[0].socketId)
        ).toHaveLength(1);
        expect(
          deaths.filter((d) => d.playerId === lovers[1].socketId)
        ).toHaveLength(1);
        expect(
          deaths.filter((d) => d.playerId === hunter.socketId)
        ).toHaveLength(1);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle empty pending deaths queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toEqual([]);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle multiple lovers dying simultaneously', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');
        yield* deathManager.addPendingDeath(lovers[1], 'WITCH_POISON');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(2);
        expect(lovers[0].isAlive).toBe(false);
        expect(lovers[1].isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should not add metadata if not present', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].metadata).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should verify timestamp is current', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');
        const beforeProcess = new Date();

        if (!victim) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const deaths = yield* game.processPendingDeaths;

        const afterProcess = new Date();

        expect(deaths).toHaveLength(1);
        expect(deaths[0].timestamp.getTime()).toBeGreaterThanOrEqual(
          beforeProcess.getTime()
        );
        expect(deaths[0].timestamp.getTime()).toBeLessThanOrEqual(
          afterProcess.getTime()
        );
      }).pipe(Effect.provide(TestLayer))
    );
  });
});

describe('Game - Witch Potion Mechanics', () => {
  describe('canWitchHeal', () => {
    it.effect('should return true when witch has heal potion initially', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const canHeal = yield* game.canWitchHeal;

        expect(canHeal).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false after using heal potion', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && victim)) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');
        yield* game.healWerewolfVictim;

        const canHeal = yield* game.canWitchHeal;

        expect(canHeal).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when witch dies', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const witch = players.find((p) => p.role === 'WITCH');

        if (!witch) {
          return;
        }

        yield* deathManager.addPendingDeath(witch, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const canHeal = yield* game.canWitchHeal;

        expect(canHeal).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should work when no witch in game', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const canHeal = yield* game.canWitchHeal;

        expect(canHeal).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('canWitchPoison', () => {
    it.effect('should return true when witch has poison potion initially', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const canPoison = yield* game.canWitchPoison;

        expect(canPoison).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false after using poison potion', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* game.witchKill(victim.socketId);

        const canPoison = yield* game.canWitchPoison;

        expect(canPoison).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when witch dies', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const witch = players.find((p) => p.role === 'WITCH');

        if (!witch) {
          return;
        }

        yield* deathManager.addPendingDeath(witch, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const canPoison = yield* game.canWitchPoison;

        expect(canPoison).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should work when no witch in game', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const canPoison = yield* game.canWitchPoison;

        expect(canPoison).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('healWerewolfVictim', () => {
    it.effect('should remove werewolf victim from death queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && victim)) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const pendingBefore = yield* deathManager.getPendingDeaths;
        expect(pendingBefore).toHaveLength(1);
        expect(pendingBefore[0].playerId).toBe(victim.socketId);

        yield* game.healWerewolfVictim;

        const pendingAfter = yield* deathManager.getPendingDeaths;
        expect(pendingAfter).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should consume heal potion', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const canHealBefore = yield* game.canWitchHeal;
        expect(canHealBefore).toBe(true);

        yield* game.healWerewolfVictim;

        const canHealAfter = yield* game.canWitchHeal;
        expect(canHealAfter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should only remove WEREWOLVES cause deaths', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolfVictim = players.find((p) => p.role === 'VILLAGER');
        const witchVictim = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== werewolfVictim?.socketId
        );

        if (!(werewolfVictim && witchVictim)) {
          return;
        }

        yield* deathManager.addPendingDeath(werewolfVictim, 'WEREWOLVES');
        yield* deathManager.addWitchPoison(witchVictim.socketId);

        const pendingBefore = yield* deathManager.getPendingDeaths;
        expect(pendingBefore).toHaveLength(2);

        yield* game.healWerewolfVictim;

        const pendingAfter = yield* deathManager.getPendingDeaths;
        expect(pendingAfter).toHaveLength(1);
        expect(pendingAfter[0].playerId).toBe(witchVictim.socketId);
        expect(pendingAfter[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle no werewolf victim in queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const canHealBefore = yield* game.canWitchHeal;
        expect(canHealBefore).toBe(true);

        yield* game.healWerewolfVictim;

        const canHealAfter = yield* game.canWitchHeal;
        expect(canHealAfter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('witchKill', () => {
    it.effect('should add poison victim to death queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* game.witchKill(victim.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(victim.socketId);
        expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should consume poison potion', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        const canPoisonBefore = yield* game.canWitchPoison;
        expect(canPoisonBefore).toBe(true);

        yield* game.witchKill(victim.socketId);

        const canPoisonAfter = yield* game.canWitchPoison;
        expect(canPoisonAfter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle multiple poison kills', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victims = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (victims.length < 2) {
          return;
        }

        yield* game.witchKill(victims[0].socketId);

        const pendingAfterFirst = yield* deathManager.getPendingDeaths;
        expect(pendingAfterFirst).toHaveLength(1);

        yield* game.witchKill(victims[1].socketId);

        const pendingAfterSecond = yield* deathManager.getPendingDeaths;
        expect(pendingAfterSecond).toHaveLength(2);
        expect(
          pendingAfterSecond.some((d) => d.playerId === victims[0].socketId)
        ).toBe(true);
        expect(
          pendingAfterSecond.some((d) => d.playerId === victims[1].socketId)
        ).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Witch Death - Potion Reset', () => {
    it.effect('should lose both potions when witch dies', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const witch = players.find((p) => p.role === 'WITCH');

        if (!witch) {
          return;
        }

        const canHealBefore = yield* game.canWitchHeal;
        const canPoisonBefore = yield* game.canWitchPoison;
        expect(canHealBefore).toBe(true);
        expect(canPoisonBefore).toBe(true);

        yield* deathManager.addPendingDeath(witch, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const canHealAfter = yield* game.canWitchHeal;
        const canPoisonAfter = yield* game.canWitchPoison;
        expect(canHealAfter).toBe(false);
        expect(canPoisonAfter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should reset potions only for witch death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!villager) {
          return;
        }

        const canHealBefore = yield* game.canWitchHeal;
        const canPoisonBefore = yield* game.canWitchPoison;
        expect(canHealBefore).toBe(true);
        expect(canPoisonBefore).toBe(true);

        yield* deathManager.addPendingDeath(villager, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const canHealAfter = yield* game.canWitchHeal;
        const canPoisonAfter = yield* game.canWitchPoison;
        expect(canHealAfter).toBe(true);
        expect(canPoisonAfter).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Witch Potion Integration', () => {
    it.effect('should handle heal then poison sequence', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolfVictim = players.find((p) => p.role === 'VILLAGER');
        const poisonVictim = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== werewolfVictim?.socketId
        );

        if (!(werewolfVictim && poisonVictim)) {
          return;
        }

        yield* deathManager.addPendingDeath(werewolfVictim, 'WEREWOLVES');
        yield* game.healWerewolfVictim;
        yield* game.witchKill(poisonVictim.socketId);

        const canHeal = yield* game.canWitchHeal;
        const canPoison = yield* game.canWitchPoison;

        expect(canHeal).toBe(false);
        expect(canPoison).toBe(false);

        const pendingDeaths = yield* deathManager.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(poisonVictim.socketId);
        expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle poison then heal sequence', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const poisonVictim = players.find((p) => p.role === 'VILLAGER');
        const werewolfVictim = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== poisonVictim?.socketId
        );

        if (!(poisonVictim && werewolfVictim)) {
          return;
        }

        yield* game.witchKill(poisonVictim.socketId);
        yield* deathManager.addPendingDeath(werewolfVictim, 'WEREWOLVES');
        yield* game.healWerewolfVictim;

        const canHeal = yield* game.canWitchHeal;
        const canPoison = yield* game.canWitchPoison;

        expect(canHeal).toBe(false);
        expect(canPoison).toBe(false);

        const pendingDeaths = yield* deathManager.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(poisonVictim.socketId);
        expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle full night cycle with witch actions', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const werewolfVictim = players.find((p) => p.role === 'VILLAGER');
        const poisonVictim = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== werewolfVictim?.socketId
        );

        if (!(werewolfVictim && poisonVictim)) {
          return;
        }

        yield* deathManager.addPendingDeath(werewolfVictim, 'WEREWOLVES');
        yield* game.healWerewolfVictim;
        yield* game.witchKill(poisonVictim.socketId);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].playerId).toBe(poisonVictim.socketId);
        expect(deaths[0].cause).toBe('WITCH_POISON');
        expect(poisonVictim.isAlive).toBe(false);
        expect(werewolfVictim.isAlive).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle witch healing when no victim exists', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        yield* game.startGame;

        const canHealBefore = yield* game.canWitchHeal;
        expect(canHealBefore).toBe(true);

        yield* game.healWerewolfVictim;

        const canHealAfter = yield* game.canWitchHeal;
        expect(canHealAfter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle multiple heal attempts', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');
        yield* game.healWerewolfVictim;

        const canHealAfterFirst = yield* game.canWitchHeal;
        expect(canHealAfterFirst).toBe(false);

        yield* game.healWerewolfVictim;

        const canHealAfterSecond = yield* game.canWitchHeal;
        expect(canHealAfterSecond).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle multiple poison attempts', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (!victim) {
          return;
        }

        yield* game.witchKill(victim.socketId);

        const canPoisonAfterFirst = yield* game.canWitchPoison;
        expect(canPoisonAfterFirst).toBe(false);

        yield* game.witchKill(victim.socketId);

        const canPoisonAfterSecond = yield* game.canWitchPoison;
        expect(canPoisonAfterSecond).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle witch death before using potions', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const witch = players.find((p) => p.role === 'WITCH');

        if (!witch) {
          return;
        }

        yield* deathManager.addPendingDeath(witch, 'WEREWOLVES');
        yield* game.processPendingDeaths;

        const canHeal = yield* game.canWitchHeal;
        const canPoison = yield* game.canWitchPoison;

        expect(canHeal).toBe(false);
        expect(canPoison).toBe(false);

        const victim = players.find((p) => p.role === 'VILLAGER');

        if (victim) {
          yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');
          yield* game.healWerewolfVictim;

          const pendingDeaths = yield* deathManager.getPendingDeaths;
          expect(pendingDeaths).toHaveLength(1);
        }
      }).pipe(Effect.provide(TestLayer))
    );
  });
});

describe('Game - Lover Mechanics', () => {
  describe('setLovers', () => {
    it.effect('should set two players as lovers', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover1 = players[0];
        const lover2 = players[1];

        const result = yield* Effect.either(
          game.setLovers([lover1.socketId, lover2.socketId])
        );

        expect(Either.isRight(result)).toBe(true);

        const lovers = yield* game.getLovers;
        expect(lovers).toHaveLength(2);
        expect(lovers[0].socketId).toBe(lover1.socketId);
        expect(lovers[1].socketId).toBe(lover2.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail when setting lover with non-existent socket id', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const lover1 = players[0];

        const result = yield* Effect.either(
          game.setLovers([lover1.socketId, 'non-existent-sid'])
        );

        expect(Either.isLeft(result)).toBe(true);
        if (Either.isLeft(result)) {
          expect(result.left.message).toContain('not found');
        }
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add lovers to existing lovers list', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover1 = players[0];
        const lover2 = players[1];

        yield* game.setLovers([lover1.socketId]);
        yield* game.setLovers([lover2.socketId]);

        const lovers = yield* game.getLovers;
        expect(lovers).toHaveLength(2);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('isPlayerLover', () => {
    it.effect('should return true for player who is a lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const lover = players[0];

        yield* game.setLovers([lover.socketId]);

        const isLover = yield* game.isPlayerLover(lover.socketId);

        expect(isLover).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false for player who is not a lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover = players[0];
        const nonLover = players[1];

        yield* game.setLovers([lover.socketId]);

        const isLover = yield* game.isPlayerLover(nonLover.socketId);

        expect(isLover).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const player = players[0];

        const isLover = yield* game.isPlayerLover(player.socketId);

        expect(isLover).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('getPartner', () => {
    it.effect('should return partner for a lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover1 = players[0];
        const lover2 = players[1];

        yield* game.setLovers([lover1.socketId, lover2.socketId]);

        const partner1 = yield* game.getPartner(lover1.socketId);
        const partner2 = yield* game.getPartner(lover2.socketId);

        expect(partner1?.socketId).toBe(lover2.socketId);
        expect(partner2?.socketId).toBe(lover1.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return undefined for non-lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 3) {
          return;
        }

        const lover1 = players[0];
        const lover2 = players[1];
        const nonLover = players[2];

        yield* game.setLovers([lover1.socketId, lover2.socketId]);

        const partner = yield* game.getPartner(nonLover.socketId);

        expect(partner).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return undefined when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const player = players[0];

        const partner = yield* game.getPartner(player.socketId);

        expect(partner).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return undefined when single lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const lover = players[0];

        yield* game.setLovers([lover.socketId]);

        const partner = yield* game.getPartner(lover.socketId);

        expect(partner).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('isOneOfLoversInDeathQueue', () => {
    it.effect('should return true when lover is in death queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover = players[0];
        const nonLover = players[1];

        yield* game.setLovers([lover.socketId]);
        yield* deathManager.addPendingDeath(lover, 'WEREWOLVES');

        const isInQueue = yield* game.isOneOfLoversInDeathQueue;

        expect(isInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when lover is not in death queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const lover = players[0];

        yield* game.setLovers([lover.socketId]);

        const isInQueue = yield* game.isOneOfLoversInDeathQueue;

        expect(isInQueue).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;

        const isInQueue = yield* game.isOneOfLoversInDeathQueue;

        expect(isInQueue).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return true when non-lover in death queue but lover not', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover = players[0];
        const nonLover = players[1];

        yield* game.setLovers([lover.socketId]);
        yield* deathManager.addPendingDeath(nonLover, 'WEREWOLVES');

        const isInQueue = yield* game.isOneOfLoversInDeathQueue;

        expect(isInQueue).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('isAnyOfLoversHunter', () => {
    it.effect('should return true when one lover is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(hunter && villager)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, villager.socketId]);

        const isHunter = yield* game.isAnyOfLoversHunter;

        expect(isHunter).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when no lover is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const villagers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (villagers.length < 2) {
          return;
        }

        yield* game.setLovers([villagers[0].socketId, villagers[1].socketId]);

        const isHunter = yield* game.isAnyOfLoversHunter;

        expect(isHunter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;

        const isHunter = yield* game.isAnyOfLoversHunter;

        expect(isHunter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('hasPartner', () => {
    it.effect('should return true for player who has a partner', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const lover = players[0];

        yield* game.setLovers([lover.socketId]);

        const hasPartner = yield* game.hasPartner(lover.socketId);

        expect(hasPartner).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false for player who does not have a partner', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 2) {
          return;
        }

        const lover = players[0];
        const nonLover = players[1];

        yield* game.setLovers([lover.socketId]);

        const hasPartner = yield* game.hasPartner(nonLover.socketId);

        expect(hasPartner).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const player = players[0];

        const hasPartner = yield* game.hasPartner(player.socketId);

        expect(hasPartner).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Lover Mechanics Integration', () => {
    it.effect('should handle full lover setup and queries', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        yield* game.setLovers([lovers[0].socketId, lovers[1].socketId]);

        const loversList = yield* game.getLovers;
        expect(loversList).toHaveLength(2);

        const isLover1 = yield* game.isPlayerLover(lovers[0].socketId);
        const isLover2 = yield* game.isPlayerLover(lovers[1].socketId);
        expect(isLover1).toBe(true);
        expect(isLover2).toBe(true);

        const partner1 = yield* game.getPartner(lovers[0].socketId);
        const partner2 = yield* game.getPartner(lovers[1].socketId);
        expect(partner1?.socketId).toBe(lovers[1].socketId);
        expect(partner2?.socketId).toBe(lovers[0].socketId);

        const hasPartner1 = yield* game.hasPartner(lovers[0].socketId);
        const hasPartner2 = yield* game.hasPartner(lovers[1].socketId);
        expect(hasPartner1).toBe(true);
        expect(hasPartner2).toBe(true);

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');

        const isInQueue = yield* game.isOneOfLoversInDeathQueue;
        expect(isInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should verify lover suicide cascade through lover methods', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lovers = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);

        if (lovers.length < 2) {
          return;
        }

        yield* game.setLovers([lovers[0].socketId, lovers[1].socketId]);

        const beforeDeathInQueue = yield* game.isOneOfLoversInDeathQueue;
        expect(beforeDeathInQueue).toBe(false);

        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');

        const afterAddInQueue = yield* game.isOneOfLoversInDeathQueue;
        expect(afterAddInQueue).toBe(true);

        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(2);
        expect(lovers[0].isAlive).toBe(false);
        expect(lovers[1].isAlive).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Hunter Revenge Mechanics', () => {
    it.effect('killHunterRevenge should add hunter revenge death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victim = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && victim)) {
          return;
        }

        yield* game.killHunterRevenge(victim.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(victim.socketId);
        expect(pendingDeaths[0].cause).toBe('HUNTER_REVENGE');
        expect(pendingDeaths[0].metadata?.hunterId).toBe(hunter.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('killHunterRevenge should fail if hunter not found', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const victim = players[0];
        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          return;
        }

        const result = yield* Effect.either(game.killHunterRevenge(victim.socketId));

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('killHunterRevenge should fail if target not found', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          return;
        }

        const result = yield* Effect.either(
          game.killHunterRevenge('non-existent-id')
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer), Effect.provide(Layer.empty))
    );

    it.effect('isHunterInLove should add partner suicide when hunter has lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lover = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && lover)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, lover.socketId]);
        yield* game.isHunterInLove;

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(lover.socketId);
        expect(pendingDeaths[0].cause).toBe('PARTNER_SUICIDE');
        expect(pendingDeaths[0].metadata?.loverId).toBe(hunter.socketId);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isHunterInLove should do nothing when hunter has no lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          return;
        }

        yield* game.isHunterInLove;

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isHunterInLove should not add suicide if partner already in queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lover = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && lover)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, lover.socketId]);
        yield* deathManager.addPendingDeath(lover, 'WEREWOLVES');
        yield* game.isHunterInLove;

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].cause).toBe('WEREWOLVES');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('hunterIsInDeathQueue should return true when hunter is in queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          return;
        }

        yield* deathManager.addPendingDeath(hunter, 'WEREWOLVES');

        const isInQueue = yield* game.hunterIsInDeathQueue;

        expect(isInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('hunterIsInDeathQueue should return false when hunter not in queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');

        if (!hunter) {
          return;
        }

        const isInQueue = yield* game.hunterIsInDeathQueue;

        expect(isInQueue).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('hunterIsInDeathQueue should return false when hunter not found', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const players = yield* game.startGame;

        yield* game.startGame;

        const isInQueue = yield* game.hunterIsInDeathQueue;

        expect(isInQueue).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isPartnerHunter should return true when surviving lover is hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lover = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && lover)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, lover.socketId]);
        yield* deathManager.addPendingDeath(lover, 'WEREWOLVES');

        const isPartnerHunter = yield* game.isPartnerHunter;

        expect(isPartnerHunter).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isPartnerHunter should return false when surviving lover not hunter', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lover1 = players.find((p) => p.role === 'VILLAGER');
        const lover2 = players.find(
          (p) => p.role === 'VILLAGER' && p !== lover1
        );

        if (!(lover1 && lover2)) {
          return;
        }

        yield* game.setLovers([lover1.socketId, lover2.socketId]);
        yield* deathManager.addPendingDeath(lover1, 'WEREWOLVES');

        const isPartnerHunter = yield* game.isPartnerHunter;

        expect(isPartnerHunter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isPartnerHunter should return false when no surviving lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const players = yield* game.startGame;

        const lover1 = players.find((p) => p.role === 'VILLAGER');
        const lover2 = players.find(
          (p) => p.role === 'VILLAGER' && p !== lover1
        );

        if (!(lover1 && lover2)) {
          return;
        }

        yield* game.setLovers([lover1.socketId, lover2.socketId]);
        yield* deathManager.addPendingDeath(lover1, 'WEREWOLVES');
        yield* deathManager.addPendingDeath(lover2, 'WEREWOLVES');

        const isPartnerHunter = yield* game.isPartnerHunter;

        expect(isPartnerHunter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('isPartnerHunter should return false when no lovers set', () =>
      Effect.gen(function* () {
        const game = yield* Game;

        const isPartnerHunter = yield* game.isPartnerHunter;

        expect(isPartnerHunter).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
