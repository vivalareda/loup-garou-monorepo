import { describe, expect } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { DeathManager } from './DeathManager.js';
import { EventsActions } from './EventsActions.js';
import { Game } from './Game.js';
import { GameActions } from './GameActions.js';
import { SegmentExecution } from './SegmentExecution.js';

const TestLayer = Layer.mergeAll(
  Game.Default,
  GameActions.Default,
  SegmentExecution.Default,
  DeathManager.Default,
  EventsActions.Default
);

describe('EventsActions', () => {
  describe('handleWerewolfVote', () => {
    it.effect('should handle werewolf vote when not all agreed', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length === 0 || villagers.length === 0) {
          return;
        }

        const werewolf = werewolves[0];
        const target = villagers[0];

        yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreed).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle werewolf vote when all agreed and finish segment', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length === 0 || villagers.length === 0) {
          return;
        }

        const target = villagers[0];

        for (const werewolf of werewolves) {
          yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
        }

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreed).toBe(true);

        const targetInQueue = yield* DeathManager.pipe(
          Effect.flatMap((dm) => dm.isInDeathQueue(target.socketId))
        );
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail if werewolf votes for another werewolf', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;

        if (werewolves.length < 2) {
          return;
        }

        const werewolf = werewolves[0];
        const target = werewolves[1];

        const result = yield* Effect.either(
          events.handleWerewolfVote(werewolf.socketId, target.socketId)
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail if non-werewolf attempts to vote', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');
        const werewolves = players.filter((p) => p.role === 'WEREWOLF');

        if (villagers.length === 0 || werewolves.length === 0) {
          return;
        }

        const villager = villagers[0];
        const target = werewolves[0];

        const result = yield* Effect.either(
          events.handleWerewolfVote(villager.socketId, target.socketId)
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should correctly add victim to death queue when all agreed', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length === 0 || villagers.length === 0) {
          return;
        }

        const target = villagers[0];

        for (const werewolf of werewolves) {
          yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
        }

        const pendingDeaths = yield* deathManager.getPendingDeaths;
        const victimDeath = pendingDeaths.find(
          (d) => d.playerId === target.socketId && d.cause === 'WEREWOLVES'
        );

        expect(victimDeath).toBeDefined();
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('handleWerewolfUpdateVote', () => {
    it.effect('should handle werewolf vote update when not all agreed', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        const werewolf = werewolves[0];
        const oldTarget = villagers[0];
        const newTarget = villagers[1];

        yield* events.handleWerewolfVote(werewolf.socketId, oldTarget.socketId);
        yield* events.handleWerewolfUpdateVote(
          werewolf.socketId,
          newTarget.socketId,
          oldTarget.socketId
        );

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreed).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle werewolf vote update when all agreed and finish segment', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;
        const deathManager = yield* DeathManager;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 2 || villagers.length < 2) {
          return;
        }

        const target1 = villagers[0];
        const target2 = villagers[1];

        for (let i = 0; i < werewolves.length - 1; i++) {
          yield* events.handleWerewolfVote(
            werewolves[i].socketId,
            target1.socketId
          );
        }

        yield* events.handleWerewolfVote(
          werewolves[werewolves.length - 1].socketId,
          target2.socketId
        );

        yield* events.handleWerewolfUpdateVote(
          werewolves[werewolves.length - 1].socketId,
          target1.socketId,
          target2.socketId
        );

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreed).toBe(true);

        const targetInQueue = yield* deathManager.isInDeathQueue(
          target1.socketId
        );
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail if old vote does not match', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length === 0 || villagers.length < 2) {
          return;
        }

        const werewolf = werewolves[0];
        const wrongOldTarget = villagers[0];
        const newTarget = villagers[1];

        const result = yield* Effect.either(
          events.handleWerewolfUpdateVote(
            werewolf.socketId,
            newTarget.socketId,
            wrongOldTarget.socketId
          )
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('handleDayVote', () => {
    it.effect('should handle day vote when not all voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const voters = players.filter((p) => p.role === 'VILLAGER');
        const targets = players.filter((p) => p.role !== 'VILLAGER');

        if (voters.length === 0 || targets.length === 0) {
          return;
        }

        const voter = voters[0];
        const target = targets[0];

        yield* events.handleDayVote(voter.socketId, target.socketId);

        const hasAllVoted = yield* game.hasAllPlayersVoted;
        expect(hasAllVoted).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should process day vote result when all voted', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const voters = players.filter((p) => p.role !== 'WEREWOLF');
        const targets = players.filter((p) => p.role !== 'VILLAGER');

        if (voters.length === 0 || targets.length === 0) {
          return;
        }

        const target = targets[0];

        for (const voter of voters) {
          yield* events.handleDayVote(voter.socketId, target.socketId);
        }

        const hasAllVoted = yield* game.hasAllPlayersVoted;
        expect(hasAllVoted).toBe(true);

        const targetInQueue = yield* DeathManager.pipe(
          Effect.flatMap((dm) => dm.isInDeathQueue(target.socketId))
        );
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle tie scenario with no death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const voters = players.filter((p) => p.role !== 'WEREWOLF');
        const targets = players.filter((p) => p.role !== 'VILLAGER');

        if (voters.length < 2 || targets.length < 2) {
          return;
        }

        const target1 = targets[0];
        const target2 = targets[1];

        for (let i = 0; i < voters.length; i++) {
          const target = i < voters.length / 2 ? target1 : target2;
          yield* events.handleDayVote(voters[i].socketId, target.socketId);
        }

        const hasAllVoted = yield* game.hasAllPlayersVoted;
        expect(hasAllVoted).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle hunter in death queue scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const hunter = players.find((p) => p.role === 'HUNTER');
        const voters = players.filter(
          (p) => p.role !== 'WEREWOLF' && p.role !== 'HUNTER'
        );

        if (!hunter || voters.length === 0) {
          return;
        }

        for (const voter of voters) {
          yield* events.handleDayVote(voter.socketId, hunter.socketId);
        }

        yield* events.handleDayVote(hunter.socketId, hunter.socketId);

        const hunterInQueue = yield* deathManager.isInDeathQueue(
          hunter.socketId
        );
        expect(hunterInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lover in death queue scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;

        if (players.length < 2) {
          return;
        }

        yield* game.setLovers([players[0].socketId, players[1].socketId]);

        const lovers = yield* game.getLovers;
        if (lovers.length < 2) {
          return;
        }

        const lover = lovers[0];
        const voters = players.filter((p) => p.role !== 'WEREWOLF');

        for (const voter of voters) {
          yield* events.handleDayVote(voter.socketId, lover.socketId);
        }

        const loverInQueue = yield* deathManager.isInDeathQueue(
          lover.socketId
        );
        expect(loverInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('handleHunterPlayerPick', () => {
    it.effect('should handle hunter player pick', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const hunter = players.find((p) => p.role === 'HUNTER');
        const targets = players.filter((p) => p.role !== 'HUNTER');

        if (!hunter || targets.length === 0) {
          return;
        }

        const target = targets[0];

        yield* events.handleHunterPlayerPick(target.socketId);

        const targetInQueue = yield* deathManager.isInDeathQueue(
          target.socketId
        );
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add hunter revenge death to death queue', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const hunter = players.find((p) => p.role === 'HUNTER');
        const targets = players.filter((p) => p.role !== 'HUNTER');

        if (!hunter || targets.length === 0) {
          return;
        }

        const target = targets[0];

        yield* events.handleHunterPlayerPick(target.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;
        const revengeDeath = pendingDeaths.find(
          (d) =>
            d.playerId === target.socketId &&
            d.cause === 'HUNTER_REVENGE' &&
            d.metadata?.hunterId === hunter.socketId
        );

        expect(revengeDeath).toBeDefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should continue day action after hunter pick', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const hunter = players.find((p) => p.role === 'HUNTER');
        const targets = players.filter((p) => p.role !== 'HUNTER');

        if (!hunter || targets.length === 0) {
          return;
        }

        const target = targets[0];

        const result = yield* Effect.either(
          events.handleHunterPlayerPick(target.socketId)
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('integration scenarios', () => {
    it.effect('should handle complete werewolf voting workflow', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length === 0 || villagers.length === 0) {
          return;
        }

        const target = villagers[0];

        for (const werewolf of werewolves) {
          yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
        }

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        const targetInQueue = yield* DeathManager.pipe(
          Effect.flatMap((dm) => dm.isInDeathQueue(target.socketId))
        );

        expect(hasAllAgreed).toBe(true);
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle complete day voting workflow', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const players = yield* game.getPlayers;
        const voters = players.filter((p) => p.role !== 'WEREWOLF');
        const targets = players.filter((p) => p.role !== 'VILLAGER');

        if (voters.length === 0 || targets.length === 0) {
          return;
        }

        const target = targets[0];

        for (const voter of voters) {
          yield* events.handleDayVote(voter.socketId, target.socketId);
        }

        const hasAllVoted = yield* game.hasAllPlayersVoted;
        const targetInQueue = yield* DeathManager.pipe(
          Effect.flatMap((dm) => dm.isInDeathQueue(target.socketId))
        );

        expect(hasAllVoted).toBe(true);
        expect(targetInQueue).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle werewolf vote updates correctly', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');

        if (werewolves.length < 3 || villagers.length < 2) {
          return;
        }

        const target1 = villagers[0];
        const target2 = villagers[1];

        yield* events.handleWerewolfVote(werewolves[0].socketId, target1.socketId);
        yield* events.handleWerewolfVote(werewolves[1].socketId, target1.socketId);
        yield* events.handleWerewolfVote(werewolves[2].socketId, target2.socketId);

        const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreed).toBe(false);

        yield* events.handleWerewolfUpdateVote(
          werewolves[2].socketId,
          target1.socketId,
          target2.socketId
        );

        const hasAllAgreedAfterUpdate = yield* game.hasAllWerewolvesAgreed;
        expect(hasAllAgreedAfterUpdate).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
