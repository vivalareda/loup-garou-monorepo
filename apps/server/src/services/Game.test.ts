import { describe, expect } from '@effect/vitest';
import { Effect, Either } from 'effect';
import { Game } from './Game.js';

const TestLayer = Game.Default;

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
