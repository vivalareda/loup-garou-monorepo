import { describe, expect, it } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { AudioManager } from './audio-manager.js';
import { DeathManager } from './death-manager.js';
import { EventsActions } from './events-actions.js';
import { Game } from './game.js';
import { GameActions } from './game-actions.js';
import { LobbyConfig } from './lobby-config.js';
import { SegmentExecution } from './segment-execution.js';
import { SegmentManager } from './segment-manager.js';
import { SpecialScenarios } from './special-scenarios.js';

const FullGameTestLayer = Layer.mergeAll(
  LobbyConfig.Test,
  AudioManager.Default,
  DeathManager.Default,
  Game.Default,
  GameActions.Default,
  SegmentManager.Default,
  SpecialScenarios.Default,
  SegmentExecution.Default,
  EventsActions.Default
);

describe('Full Game Integration - Complete Night Phase', () => {
  it.effect('should complete full night phase with werewolf kill', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      const players = yield* game.startGame;
      const werewolves = yield* game.getWerewolfList;
      const villagers = players.filter((p) => p.role === 'VILLAGER');
      const witches = players.filter((p) => p.role === 'WITCH');

      if (
        werewolves.length === 0 ||
        villagers.length === 0 ||
        witches.length === 0
      ) {
        return;
      }

      const target = villagers[0];

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
      }

      expect(yield* segmentManager.getCurrentSegmentType).toBe('WEREWOLF');
      yield* segmentExecution.finishSegment;

      expect(yield* segmentManager.getCurrentSegmentType).toBe('WITCH-HEAL');
      yield* segmentExecution.playSegment;

      const deathManager = yield* DeathManager;

      const canHeal = yield* game.canWitchHeal;
      expect(canHeal).toBe(true);

      yield* events.handleWitchHeal(target.socketId);

      const stillInQueue = yield* deathManager.isInDeathQueue(target.socketId);
      expect(stillInQueue).toBe(false);

      const canHealAfter = yield* game.canWitchHeal;
      expect(canHealAfter).toBe(false);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect(
    'should complete full night phase with werewolf kill and witch poisoning',
    () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const events = yield* EventsActions;
        const segmentExecution = yield* SegmentExecution;
        const segmentManager = yield* SegmentManager;

        yield* game.startGame;
        const werewolves = yield* game.getWerewolfList;
        const players = yield* game.getPlayers;
        const villagers = players.filter((p) => p.role === 'VILLAGER');
        const witches = players.filter((p) => p.role === 'WITCH');

        if (
          werewolves.length === 0 ||
          villagers.length < 2 ||
          witches.length === 0
        ) {
          return;
        }

        const target = villagers[0];
        const poisonTarget = villagers[1];

        yield* segmentExecution.playSegment;
        yield* segmentExecution.finishSegment;
        yield* segmentExecution.finishSegment;
        yield* segmentExecution.playSegment;

        for (const werewolf of werewolves) {
          yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
        }

        yield* segmentExecution.finishSegment;

        expect(yield* segmentManager.getCurrentSegmentType).toBe('WITCH-HEAL');
        yield* segmentExecution.finishSegment;

        expect(yield* segmentManager.getCurrentSegmentType).toBe(
          'WITCH-POISON'
        );
        yield* segmentExecution.playSegment;

        const canPoison = yield* game.canWitchPoison;
        expect(canPoison).toBe(true);

        yield* events.handleWitchPoison(poisonTarget.socketId);

        const poisonTargetInQueue = yield* DeathManager.pipe(
          Effect.flatMap((dm) => dm.isInDeathQueue(poisonTarget.socketId))
        );
        expect(poisonTargetInQueue).toBe(true);

        const canPoisonAfter = yield* game.canWitchPoison;
        expect(canPoisonAfter).toBe(false);
      }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Complete Day Phase', () => {
  it.effect('should complete full day phase with voting and elimination', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const alivePlayers = players.filter((p) => p.isAlive);

      if (alivePlayers.length < 3) {
        return;
      }

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of yield* game.getWerewolfList) {
        yield* events.handleWerewolfVote(
          werewolf.socketId,
          alivePlayers[0].socketId
        );
      }
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;

      expect(yield* segmentManager.getCurrentSegmentType).toBe('DAY');
      yield* segmentExecution.playSegment;

      for (let i = 1; i < alivePlayers.length; i++) {
        yield* events.handleDayVote(
          alivePlayers[i].socketId,
          alivePlayers[0].socketId
        );
      }

      const allVoted = yield* game.hasAllPlayersVoted;
      expect(allVoted).toBe(true);

      const target = yield* game.getDayVoteTarget;
      expect(target).toBe(alivePlayers[0].socketId);

      const targetInQueue = yield* DeathManager.pipe(
        Effect.flatMap((dm) => dm.isInDeathQueue(alivePlayers[0].socketId))
      );
      expect(targetInQueue).toBe(true);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should handle day phase with tie and no elimination', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const alivePlayers = players.filter((p) => p.isAlive);

      if (alivePlayers.length < 4) {
        return;
      }

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      const nightTarget = alivePlayers[4] ?? alivePlayers[0];
      for (const werewolf of yield* game.getWerewolfList) {
        yield* events.handleWerewolfVote(
          werewolf.socketId,
          nightTarget.socketId
        );
      }
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      yield* events.handleDayVote(
        alivePlayers[0].socketId,
        alivePlayers[1].socketId
      );
      yield* events.handleDayVote(
        alivePlayers[2].socketId,
        alivePlayers[3].socketId
      );
      for (let i = 4; i < alivePlayers.length; i++) {
        const target =
          i % 2 === 0 ? alivePlayers[1].socketId : alivePlayers[3].socketId;
        yield* events.handleDayVote(alivePlayers[i].socketId, target);
      }

      const target = yield* game.getDayVoteTarget;
      expect(target).toBeNull();
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Multiple Cycles', () => {
  it.effect('should complete multiple night/day cycles', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;

      const players = yield* game.startGame;
      let winner = yield* game.checkIfWinner;
      let cycleCount = 0;
      const maxCycles = 3;

      while (winner === null && cycleCount < maxCycles) {
        const alivePlayers = players.filter((p) => p.isAlive);
        const werewolves = alivePlayers.filter((p) => p.role === 'WEREWOLF');

        if (werewolves.length === 0 || alivePlayers.length < 3) {
          break;
        }

        const villagers = alivePlayers.filter((p) => p.role !== 'WEREWOLF');

        yield* segmentExecution.playSegment;
        yield* segmentExecution.finishSegment;
        yield* segmentExecution.finishSegment;
        yield* segmentExecution.playSegment;

        const nightTarget = villagers[0];
        for (const werewolf of werewolves) {
          yield* events.handleWerewolfVote(
            werewolf.socketId,
            nightTarget.socketId
          );
        }

        yield* segmentExecution.finishSegment;
        yield* segmentExecution.finishSegment;
        yield* segmentExecution.playSegment;

        for (let i = 1; i < alivePlayers.length; i++) {
          const target =
            i % 2 === 0 ? alivePlayers[1].socketId : alivePlayers[0].socketId;
          yield* events.handleDayVote(alivePlayers[i].socketId, target);
        }

        yield* game.processPendingDeaths;
        yield* segmentExecution.finishSegment;

        winner = yield* game.checkIfWinner;
        cycleCount++;
      }

      expect(cycleCount).toBeGreaterThan(0);
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Winner Detection', () => {
  it.effect('should detect villagers win when all werewolves eliminated', () =>
    Effect.gen(function* () {
      const game = yield* Game;

      yield* game.startGame;
      const werewolves = yield* game.getWerewolfList;

      if (werewolves.length === 0) {
        return;
      }

      for (const werewolf of werewolves) {
        const deathManager = yield* DeathManager;
        yield* deathManager.addPendingDeath(werewolf, 'DAY_VOTE');
        yield* game.processPendingDeaths;
      }

      const winner = yield* game.checkIfWinner;
      expect(winner).toBe('villagers');
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should detect werewolves win when equal to villagers', () =>
    Effect.gen(function* () {
      const game = yield* Game;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const werewolves = players.filter((p) => p.role === 'WEREWOLF');
      const villagers = players.filter((p) => p.role !== 'WEREWOLF');

      if (werewolves.length < 2 || villagers.length < 2) {
        return;
      }

      for (let i = 1; i < werewolves.length; i++) {
        werewolves[i].setIsAlive(false);
      }

      for (let i = 1; i < villagers.length; i++) {
        const deathManager = yield* DeathManager;
        yield* deathManager.addPendingDeath(villagers[i], 'WEREWOLVES');
        yield* game.processPendingDeaths;
      }

      const winner = yield* game.checkIfWinner;
      expect(winner).toBe('werewolves');
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Lovers Suicide', () => {
  it.effect('should trigger lover suicide when one lover dies', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const werewolves = yield* game.getWerewolfList;
      const villagers = players.filter((p) => p.role === 'VILLAGER');

      if (werewolves.length === 0 || villagers.length < 2) {
        return;
      }

      const lovers = villagers.slice(0, 2);
      yield* game.setLovers([lovers[0].socketId, lovers[1].socketId]);

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* events.handleWerewolfVote(werewolf.socketId, lovers[0].socketId);
      }

      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      const deaths = yield* game.processPendingDeaths;

      expect(deaths.some((d) => d.playerId === lovers[0].socketId)).toBe(true);
      expect(deaths.some((d) => d.playerId === lovers[1].socketId)).toBe(true);
      expect(deaths.some((d) => d.cause === 'PARTNER_SUICIDE')).toBe(true);
      expect(lovers[0].isAlive).toBe(false);
      expect(lovers[1].isAlive).toBe(false);
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Hunter Revenge', () => {
  it.effect('should handle hunter revenge when hunter dies', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const gameActions = yield* GameActions;
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      const players = yield* game.startGame;
      const werewolves = players.filter((p) => p.role === 'WEREWOLF');
      const hunters = players.filter((p) => p.role === 'HUNTER');
      const villagers = players.filter((p) => p.role === 'VILLAGER');

      if (hunters.length === 0 || villagers.length === 0) {
        return;
      }

      const hunter = hunters[0];
      const target = villagers[0];

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* game.handleWerewolfVote(werewolf.socketId, hunter.socketId);
      }

      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      yield* game.processPendingDeaths;

      expect(hunter.isAlive).toBe(false);

      expect(yield* segmentManager.getCurrentSegmentType).toBe('HUNTER');
      yield* segmentExecution.playSegment;

      const result = yield* Effect.either(
        gameActions.handleHunterPlayerPick(target.socketId)
      );

      if (Either.isRight(result)) {
        expect(target.isAlive).toBe(false);
      }
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Complex Scenarios', () => {
  it.effect('should handle werewolf kills lover who is hunter', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const specialScenarios = yield* SpecialScenarios;
      const segmentExecution = yield* SegmentExecution;

      const players = yield* game.startGame;
      const werewolves = players.filter((p) => p.role === 'WEREWOLF');
      const hunters = players.filter((p) => p.role === 'HUNTER');
      const villagers = players.filter((p) => p.role === 'VILLAGER');

      if (
        werewolves.length === 0 ||
        hunters.length === 0 ||
        villagers.length === 0
      ) {
        return;
      }

      const hunter = hunters[0];
      const lover = villagers[0];

      yield* game.setLovers([hunter.socketId, lover.socketId]);

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* events.handleWerewolfVote(werewolf.socketId, hunter.socketId);
      }

      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      yield* specialScenarios.hunterIsLover;

      const deaths = yield* game.processPendingDeaths;

      expect(
        deaths.some(
          (d) => d.playerId === hunter.socketId && d.cause === 'WEREWOLVES'
        )
      ).toBe(true);
      expect(
        deaths.some(
          (d) => d.playerId === lover.socketId && d.cause === 'PARTNER_SUICIDE'
        )
      ).toBe(true);

      expect(hunter.isAlive).toBe(false);
      expect(lover.isAlive).toBe(false);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should handle lover dies and partner is hunter scenario', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const specialScenarios = yield* SpecialScenarios;
      const segmentExecution = yield* SegmentExecution;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const werewolves = yield* game.getWerewolfList;
      const hunters = players.filter((p) => p.role === 'HUNTER');
      const villagers = players.filter((p) => p.role === 'VILLAGER');

      if (
        werewolves.length === 0 ||
        hunters.length === 0 ||
        villagers.length === 0
      ) {
        return;
      }

      const hunter = hunters[0];
      const lover = villagers[0];

      yield* game.setLovers([hunter.socketId, lover.socketId]);

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* events.handleWerewolfVote(werewolf.socketId, lover.socketId);
      }

      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      yield* specialScenarios.partnerIsHunter;

      const deaths = yield* game.processPendingDeaths;

      expect(
        deaths.some(
          (d) => d.playerId === lover.socketId && d.cause === 'WEREWOLVES'
        )
      ).toBe(true);
      expect(
        deaths.some(
          (d) => d.playerId === hunter.socketId && d.cause === 'PARTNER_SUICIDE'
        )
      ).toBe(true);

      expect(lover.isAlive).toBe(false);
      expect(hunter.isAlive).toBe(false);
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});

describe('Full Game Integration - Edge Cases', () => {
  it.effect('should handle all players voting in day phase', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;

      yield* game.startGame;
      const players = yield* game.getPlayers;
      const alivePlayers = players.filter((p) => p.isAlive);

      if (alivePlayers.length < 3) {
        return;
      }

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of yield* game.getWerewolfList) {
        yield* events.handleWerewolfVote(
          werewolf.socketId,
          alivePlayers[0].socketId
        );
      }
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (let i = 1; i < alivePlayers.length; i++) {
        yield* events.handleDayVote(
          alivePlayers[i].socketId,
          alivePlayers[0].socketId
        );
      }

      const allVoted = yield* game.hasAllPlayersVoted;
      expect(allVoted).toBe(true);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should handle witch with no potions', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const events = yield* EventsActions;
      const segmentExecution = yield* SegmentExecution;

      yield* game.startGame;
      const werewolves = yield* game.getWerewolfList;
      const players = yield* game.getPlayers;
      const villagers = players.filter((p) => p.role === 'VILLAGER');

      if (werewolves.length === 0 || villagers.length === 0) {
        return;
      }

      const target = villagers[0];

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      for (const werewolf of werewolves) {
        yield* events.handleWerewolfVote(werewolf.socketId, target.socketId);
      }

      yield* segmentExecution.finishSegment;
      yield* segmentExecution.finishSegment;
      yield* segmentExecution.playSegment;

      let canHeal = yield* game.canWitchHeal;
      if (canHeal) {
        yield* events.handleWitchHeal(target.socketId);
      }

      yield* segmentExecution.finishSegment;

      canHeal = yield* game.canWitchHeal;
      expect(canHeal).toBe(false);

      const canPoison = yield* game.canWitchPoison;
      if (canPoison) {
        yield* segmentExecution.playSegment;
        const poisonTarget = villagers[1] ?? target;
        yield* events.handleWitchPoison(poisonTarget.socketId);
      }

      const canPoisonAfter = yield* game.canWitchPoison;
      expect(canPoisonAfter).toBe(false);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should handle game with minimum players', () =>
    Effect.gen(function* () {
      const game = yield* Game;
      const segmentExecution = yield* SegmentExecution;

      const players = yield* game.startGame;

      expect(players.length).toBeGreaterThanOrEqual(4);

      const winner = yield* game.checkIfWinner;
      expect(winner).toBeNull();

      const werewolves = yield* game.getWerewolfList;
      expect(werewolves.length).toBeGreaterThan(0);
    }).pipe(Effect.provide(FullGameTestLayer))
  );

  it.effect('should handle empty death queue correctly', () =>
    Effect.gen(function* () {
      const game = yield* Game;

      yield* game.startGame;

      const deaths = yield* game.processPendingDeaths;
      expect(deaths).toEqual([]);

      const deathManager = yield* DeathManager;
      const pendingDeaths = yield* deathManager.getPendingDeaths;
      expect(pendingDeaths).toHaveLength(0);
    }).pipe(Effect.provide(FullGameTestLayer))
  );
});
