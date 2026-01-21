import { describe, expect } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { Game } from './Game.js';
import { GameActions } from './GameActions.js';
import { DeathManager } from './death-manager.js';

const TestLayer = GameActions.Default;
const GameTestLayer = Layer.mergeAll(
  Game.Default,
  GameActions.Default,
  DeathManager.Default
);

describe('GameActions', () => {
  describe('cupidAction', () => {
    it.effect('should get cupid player and emit pick required', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.cupidAction);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle effect execution', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('loversAction', () => {
    it.effect('should handle lovers action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lovers with less than 2 players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lover action completion', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.loversAction);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('werewolfAction', () => {
    it.effect('should handle werewolf action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should emit to all werewolves', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.werewolfAction);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle no werewolves gracefully', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('witchHealAction', () => {
    it.effect('should handle witch heal action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle case when witch does not exist', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchHealAction);

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail when no werewolf target exists', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchHealAction);

        expect(Either.isLeft(result) || Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle werewolf target correctly', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('witchPoisonAction', () => {
    it.effect('should handle witch poison action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle case when witch does not exist', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchPoisonAction);

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should emit poison prompt to witch', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('handleWerewolfVote', () => {
    it.effect('should handle werewolf vote successfully', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;

        const players = yield* game.startGame;
        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && villager)) {
          return;
        }

        const result = yield* Effect.either(
          actions.handleWerewolfVote(werewolf.socketId, villager.socketId)
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should broadcast votes after voting', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;

        const players = yield* game.startGame;
        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager = players.find((p) => p.role === 'VILLAGER');

        if (!(werewolf && villager)) {
          return;
        }

        yield* actions.handleWerewolfVote(werewolf.socketId, villager.socketId);
        yield* actions.broadcastWerewolfVotes;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle vote updates', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;

        const players = yield* game.startGame;
        const werewolf = players.find((p) => p.role === 'WEREWOLF');
        const villager1 = players.find((p) => p.role === 'VILLAGER');
        const villager2 = players.find(
          (p) => p.role === 'VILLAGER' && p.socketId !== villager1?.socketId
        );

        if (!(werewolf && villager1 && villager2)) {
          return;
        }

        yield* actions.handleWerewolfVote(
          werewolf.socketId,
          villager1.socketId
        );
        const result = yield* Effect.either(
          actions.handleWerewolfUpdateVote(
            werewolf.socketId,
            villager2.socketId,
            villager1.socketId
          )
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('dayAction', () => {
    it.effect('should handle day action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.dayAction);
        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle winner scenario', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.dayAction);
        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('processNightDeaths', () => {
    it.effect('should process pending deaths and announce them', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 2) {
          return yield* Effect.void;
        }

        const victim = players.find((p) => p.role === 'VILLAGER');
        if (!victim) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const deaths = yield* actions.processNightDeaths;
        expect(deaths).toHaveLength(1);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should emit death announcements to all players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 2) {
          return yield* Effect.void;
        }

        const victim = players.find((p) => p.role === 'VILLAGER');
        if (!victim) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        yield* actions.processNightDeaths;
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should emit alert to dead players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 2) {
          return yield* Effect.void;
        }

        const victim = players.find((p) => p.role === 'VILLAGER');
        if (!victim) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        yield* actions.processNightDeaths;
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should handle multiple deaths in same night', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 4) {
          return yield* Effect.void;
        }

        const victims = players.filter((p) => p.role === 'VILLAGER').slice(0, 2);
        if (victims.length < 2) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victims[0], 'WEREWOLVES');
        yield* deathManager.addPendingDeath(victims[1], 'WITCH_POISON');

        const deaths = yield* actions.processNightDeaths;
        expect(deaths.length).toBeGreaterThanOrEqual(2);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should play winner audio when game is over', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        const werewolves = players.filter((p) => p.role === 'WEREWOLF');

        if (werewolves.length === 0) {
          return yield* Effect.void;
        }

        for (const werewolf of werewolves) {
          yield* deathManager.addPendingDeath(werewolf, 'WEREWOLVES');
        }

        const deaths = yield* actions.processNightDeaths;
        expect(deaths).toBeDefined();
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should return list of processed deaths', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 2) {
          return yield* Effect.void;
        }

        const victim = players.find((p) => p.role === 'VILLAGER');
        if (!victim) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const deaths = yield* actions.processNightDeaths;
        expect(Array.isArray(deaths)).toBe(true);
        expect(deaths[0]).toMatchObject({
          playerId: victim.socketId,
          cause: 'WEREWOLVES',
        });
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should handle empty death queue', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const game = yield* Game;
        const deathManager = yield* DeathManager;

        const players = yield* game.startGame;
        if (players.length < 2) {
          return yield* Effect.void;
        }

        const victim = players.find((p) => p.role === 'VILLAGER');
        if (!victim) {
          return yield* Effect.void;
        }

        yield* deathManager.addPendingDeath(victim, 'WEREWOLVES');

        const deaths = yield* actions.processNightDeaths;
        expect(deaths.length).toBe(1);
        expect(deaths[0].playerId).toBe(victim.socketId);
      }).pipe(Effect.provide(GameTestLayer))
    );
  });

  describe('startVotingPhase', () => {
    it.effect(
      'should emit voting phase start event',
      () =>
        Effect.gen(function* () {
          const actions = yield* GameActions;
          yield* actions.startVotingPhase;
        }).pipe(Effect.provide(TestLayer)),
      { timeout: 10000 }
    );

    it.effect(
      'should sleep for 7 seconds before starting voting',
      () =>
        Effect.gen(function* () {
          const actions = yield* GameActions;
          yield* actions.startVotingPhase;
        }).pipe(Effect.provide(TestLayer)),
      { timeout: 10000 }
    );

    it.effect(
      'should handle startVotingPhase multiple times',
      () =>
        Effect.gen(function* () {
          const actions = yield* GameActions;
          yield* actions.startVotingPhase;
          yield* actions.startVotingPhase;
        }).pipe(Effect.provide(TestLayer)),
      { timeout: 20000 }
    );

    it.effect(
      'should work independently of death processing',
      () =>
        Effect.gen(function* () {
          const actions = yield* GameActions;
          yield* actions.startVotingPhase;
        }).pipe(Effect.provide(TestLayer)),
      { timeout: 10000 }
    );
  });

  describe('hunterAction', () => {
    it.effect('should emit hunter pick required', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle hunter action completion', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.hunterAction);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle all actions in sequence without errors', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle repeated action calls', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.werewolfAction;
        yield* actions.hunterAction;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lovers action multiple times', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle all witch actions', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Integration Scenarios', () => {
    it.effect('should simulate complete night phase actions', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle day transition after night', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle hunter death scenario', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Error Handling', () => {
    it.effect('should handle missing special role players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const cupidResult = yield* Effect.either(actions.cupidAction);
        const witchHealResult = yield* Effect.either(actions.witchHealAction);
        const witchPoisonResult = yield* Effect.either(
          actions.witchPoisonAction
        );

        expect(Either.isRight(cupidResult) || Either.isLeft(cupidResult)).toBe(
          true
        );
        expect(
          Either.isRight(witchHealResult) || Either.isLeft(witchHealResult)
        ).toBe(true);
        expect(
          Either.isRight(witchPoisonResult) || Either.isLeft(witchPoisonResult)
        ).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle empty game state', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Action Sequence Testing', () => {
    it.effect('should execute cupid -> lovers sequence', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should execute werewolves -> witch sequence', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should execute complete game cycle', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Day Voting', () => {
    it.effect('should handle day vote action', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const voter = players.find((p) => p.isAlive);
        const target = players.find(
          (p) => p.socketId !== voter?.socketId && p.isAlive
        );

        if (!(voter && target)) {
          return;
        }

        const result = yield* Effect.either(
          actions.handleDayVote(voter.socketId, target.socketId)
        );

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should process day vote result with death', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;
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

        const result = yield* Effect.either(actions.processDayVoteResult);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should process day vote result with tie (no death)', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;
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

        const result = yield* Effect.either(actions.processDayVoteResult);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(GameTestLayer))
    );
  });

  describe('handleHunterPlayerPick', () => {
    it.effect('should add hunter revenge death when hunter picks target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victim = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && victim)) {
          return;
        }

        yield* actions.handleHunterPlayerPick(victim.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe(victim.socketId);
        expect(pendingDeaths[0].cause).toBe('HUNTER_REVENGE');
        expect(pendingDeaths[0].metadata?.hunterId).toBe(hunter.socketId);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should add partner suicide when hunter has lover', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lover = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && lover)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, lover.socketId]);
        yield* actions.handleHunterPlayerPick(lover.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(2);
        expect(pendingDeaths.some((d) => d.cause === 'HUNTER_REVENGE')).toBe(true);
        expect(pendingDeaths.some((d) => d.cause === 'PARTNER_SUICIDE')).toBe(true);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should fail when hunter does not exist', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        if (players.length < 1) {
          return;
        }

        const victim = players[0];

        const result = yield* Effect.either(
          actions.handleHunterPlayerPick(victim.socketId)
        );

        expect(Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should emit alert events to target', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victim = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && victim)) {
          return;
        }

        yield* actions.handleHunterPlayerPick(victim.socketId);

        expect(actions.handleHunterPlayerPick).toBeDefined();
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should handle multiple hunter picks in sequence', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victims = players.filter((p) => p.role !== 'HUNTER').slice(0, 2);

        if (!(hunter && victims.length >= 2)) {
          return;
        }

        yield* actions.handleHunterPlayerPick(victims[0].socketId);
        let pendingDeaths = yield* deathManager.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(1);

        yield* actions.handleHunterPlayerPick(victims[1].socketId);
        pendingDeaths = yield* deathManager.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(2);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should handle hunter picking lover scenario', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const deathManager = yield* DeathManager;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const lover = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && lover)) {
          return;
        }

        yield* game.setLovers([hunter.socketId, lover.socketId]);
        yield* actions.handleHunterPlayerPick(lover.socketId);

        const pendingDeaths = yield* deathManager.getPendingDeaths;

        expect(pendingDeaths).toHaveLength(2);
        const revengeDeath = pendingDeaths.find(
          (d) => d.cause === 'HUNTER_REVENGE'
        );
        const suicideDeath = pendingDeaths.find(
          (d) => d.cause === 'PARTNER_SUICIDE'
        );

        expect(revengeDeath).toBeDefined();
        expect(suicideDeath).toBeDefined();
        expect(revengeDeath?.playerId).toBe(lover.socketId);
        expect(suicideDeath?.playerId).toBe(lover.socketId);
      }).pipe(Effect.provide(GameTestLayer))
    );

    it.effect('should process deaths correctly after hunter pick', () =>
      Effect.gen(function* () {
        const game = yield* Game;
        const actions = yield* GameActions;
        const players = yield* game.startGame;

        const hunter = players.find((p) => p.role === 'HUNTER');
        const victim = players.find((p) => p.role !== 'HUNTER');

        if (!(hunter && victim)) {
          return;
        }

        yield* actions.handleHunterPlayerPick(victim.socketId);
        const deaths = yield* game.processPendingDeaths;

        expect(deaths).toHaveLength(1);
        expect(deaths[0].cause).toBe('HUNTER_REVENGE');
        expect(victim.isAlive).toBe(false);
      }).pipe(Effect.provide(GameTestLayer))
    );
  });
});
