import { describe, expect } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { Player } from '@/core/player';
import { DeathManager } from './DeathManager';

const TestLayer = DeathManager.Default;

describe('DeathManager', () => {
  describe('Team Management', () => {
    it.effect('should add werewolf to team', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'WEREWOLF');
        yield* dm.addTeamWerewolf(player);
        const werewolves = yield* dm.getTeamWerewolves;
        expect(werewolves).toHaveLength(1);
        expect(werewolves[0]).toBe(player);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add multiple werewolves to team', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player1 = new Player('Player1', 'sid1', 'WEREWOLF');
        const player2 = new Player('Player2', 'sid2', 'WEREWOLF');
        yield* dm.addTeamWerewolf(player1);
        yield* dm.addTeamWerewolf(player2);
        const werewolves = yield* dm.getTeamWerewolves;
        expect(werewolves).toHaveLength(2);
        expect(werewolves).toContain(player1);
        expect(werewolves).toContain(player2);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add villager to team', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'VILLAGER');
        yield* dm.addTeamVillager(player);
        const villagers = yield* dm.getTeamVillagers;
        expect(villagers).toHaveLength(1);
        expect(villagers[0]).toBe(player);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add multiple villagers to team', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player1 = new Player('Player1', 'sid1', 'VILLAGER');
        const player2 = new Player('Player2', 'sid2', 'VILLAGER');
        yield* dm.addTeamVillager(player1);
        yield* dm.addTeamVillager(player2);
        const villagers = yield* dm.getTeamVillagers;
        expect(villagers).toHaveLength(2);
        expect(villagers).toContain(player1);
        expect(villagers).toContain(player2);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect(
      'should maintain separate teams for werewolves and villagers',
      () =>
        Effect.gen(function* () {
          const dm = yield* DeathManager;
          const werewolf = new Player('Werewolf', 'sid1', 'WEREWOLF');
          const villager = new Player('Villager', 'sid2', 'VILLAGER');
          yield* dm.addTeamWerewolf(werewolf);
          yield* dm.addTeamVillager(villager);
          const werewolves = yield* dm.getTeamWerewolves;
          const villagers = yield* dm.getTeamVillagers;
          expect(werewolves).toHaveLength(1);
          expect(werewolves[0]).toBe(werewolf);
          expect(villagers).toHaveLength(1);
          expect(villagers[0]).toBe(villager);
        }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Death Queue Management', () => {
    it.effect('should check if player is in death queue', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'WEREWOLF');
        const beforeAdd = yield* dm.isInDeathQueue('sid1');
        yield* dm.addPendingDeath(player, 'WEREWOLVES');
        const afterAdd = yield* dm.isInDeathQueue('sid1');
        expect(beforeAdd).toBe(false);
        expect(afterAdd).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add pending death with default cause WEREWOLVES', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'VILLAGER');
        yield* dm.addPendingDeath(player);
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('sid1');
        expect(pendingDeaths[0].cause).toBe('WEREWOLVES');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should add pending death with specified cause', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'VILLAGER');
        yield* dm.addPendingDeath(player, 'WITCH_POISON');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('sid1');
        expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should remove pending death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player = new Player('Player1', 'sid1', 'VILLAGER');
        yield* dm.addPendingDeath(player, 'WEREWOLVES');
        const removed = yield* dm.removePendingDeath('sid1');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(removed).toBeDefined();
        expect(removed?.playerId).toBe('sid1');
        expect(pendingDeaths).toHaveLength(0);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return undefined when removing non-existent death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const removed = yield* dm.removePendingDeath('nonexistent');
        expect(removed).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should get all pending deaths', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player1 = new Player('Player1', 'sid1', 'VILLAGER');
        const player2 = new Player('Player2', 'sid2', 'WEREWOLF');
        yield* dm.addPendingDeath(player1, 'WEREWOLVES');
        yield* dm.addPendingDeath(player2, 'WITCH_POISON');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(2);
        expect(pendingDeaths[0].playerId).toBe('sid1');
        expect(pendingDeaths[1].playerId).toBe('sid2');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return empty array when no pending deaths', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths).toEqual([]);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Healing Logic', () => {
    it.effect(
      'should heal werewolves victim by removing WEREWOLVES deaths',
      () =>
        Effect.gen(function* () {
          const dm = yield* DeathManager;
          const player1 = new Player('Player1', 'sid1', 'VILLAGER');
          const player2 = new Player('Player2', 'sid2', 'VILLAGER');
          yield* dm.addPendingDeath(player1, 'WEREWOLVES');
          yield* dm.addPendingDeath(player2, 'WITCH_POISON');
          yield* dm.healWerewolvesVictim;
          const pendingDeaths = yield* dm.getPendingDeaths;
          expect(pendingDeaths).toHaveLength(1);
          expect(pendingDeaths[0].playerId).toBe('sid2');
          expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
        }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should heal multiple werewolf victims', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player1 = new Player('Player1', 'sid1', 'VILLAGER');
        const player2 = new Player('Player2', 'sid2', 'VILLAGER');
        const player3 = new Player('Player3', 'sid3', 'VILLAGER');
        yield* dm.addPendingDeath(player1, 'WEREWOLVES');
        yield* dm.addPendingDeath(player2, 'WEREWOLVES');
        yield* dm.addPendingDeath(player3, 'WITCH_POISON');
        yield* dm.healWerewolvesVictim;
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths).toHaveLength(1);
        expect(pendingDeaths[0].playerId).toBe('sid3');
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should do nothing when no werewolf deaths exist', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const player1 = new Player('Player1', 'sid1', 'VILLAGER');
        const player2 = new Player('Player2', 'sid2', 'VILLAGER');
        yield* dm.addPendingDeath(player1, 'WITCH_POISON');
        yield* dm.addPendingDeath(player2, 'DAY_VOTE');
        const beforeHeal = yield* dm.getPendingDeaths;
        yield* dm.healWerewolvesVictim;
        const afterHeal = yield* dm.getPendingDeaths;
        expect(beforeHeal).toEqual(afterHeal);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Partner Suicide', () => {
    it.effect('should add partner suicide death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        yield* dm.addPartnerSuicide('partnerSid', 'deadLoverSid');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('partnerSid');
        expect(pendingDeaths[0].cause).toBe('PARTNER_SUICIDE');
        expect(pendingDeaths[0].metadata?.loverId).toBe('deadLoverSid');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Hunter Revenge', () => {
    it.effect('should add hunter revenge death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        yield* dm.addHunterRevenge('victimSid', 'hunterSid');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('victimSid');
        expect(pendingDeaths[0].cause).toBe('HUNTER_REVENGE');
        expect(pendingDeaths[0].metadata?.hunterId).toBe('hunterSid');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Day Vote Elimination', () => {
    it.effect('should add day vote elimination death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        yield* dm.addDayVoteElimination('victimSid', 5);
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('victimSid');
        expect(pendingDeaths[0].cause).toBe('DAY_VOTE');
        expect(pendingDeaths[0].metadata?.voteCount).toBe(5);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Witch Poison', () => {
    it.effect('should add witch poison death', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        yield* dm.addWitchPoison('victimSid');
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(pendingDeaths[0].playerId).toBe('victimSid');
        expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect(
      'should handle adding same player to death queue multiple times',
      () =>
        Effect.gen(function* () {
          const dm = yield* DeathManager;
          const player = new Player('Player1', 'sid1', 'VILLAGER');
          yield* dm.addPendingDeath(player, 'WEREWOLVES');
          yield* dm.addPendingDeath(player, 'WITCH_POISON');
          const pendingDeaths = yield* dm.getPendingDeaths;
          expect(pendingDeaths).toHaveLength(1);
          expect(pendingDeaths[0].cause).toBe('WITCH_POISON');
        }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle removing death from empty queue', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const removed = yield* dm.removePendingDeath('nonexistent');
        expect(removed).toBeUndefined();
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect(
      'should handle checking death queue for non-existent player',
      () =>
        Effect.gen(function* () {
          const dm = yield* DeathManager;
          const result = yield* dm.isInDeathQueue('nonexistent');
          expect(result).toBe(false);
        }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should maintain team integrity with multiple operations', () =>
      Effect.gen(function* () {
        const dm = yield* DeathManager;
        const players = [
          new Player('Player1', 'sid1', 'WEREWOLF'),
          new Player('Player2', 'sid2', 'WEREWOLF'),
          new Player('Player3', 'sid3', 'VILLAGER'),
          new Player('Player4', 'sid4', 'VILLAGER'),
        ];
        yield* dm.addTeamWerewolf(players[0]);
        yield* dm.addTeamWerewolf(players[1]);
        yield* dm.addTeamVillager(players[2]);
        yield* dm.addTeamVillager(players[3]);
        yield* dm.addPendingDeath(players[0], 'DAY_VOTE');
        yield* dm.addPendingDeath(players[3], 'WITCH_POISON');
        const werewolves = yield* dm.getTeamWerewolves;
        const villagers = yield* dm.getTeamVillagers;
        const pendingDeaths = yield* dm.getPendingDeaths;
        expect(werewolves).toHaveLength(2);
        expect(villagers).toHaveLength(2);
        expect(pendingDeaths).toHaveLength(2);
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
