import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import {
  DeathManagerLive,
  DeathManagerService,
} from '@/core/death-manager-effect';
import type { Player } from '@/core/player';

const createMockPlayer = (id: string) =>
  ({
    getSocketId: () => id,
    id,
  }) as unknown as Player;

describe('DeathManagerService', () => {
  const TestLayer = DeathManagerLive;

  it('should add and retrieve team werewolves', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);
      const player = createMockPlayer('p1');

      yield* _(service.addTeamWerewolf(player));
      const werewolves = yield* _(service.getTeamWerewolves);

      expect(werewolves).toHaveLength(1);
      expect(werewolves[0].getSocketId()).toBe('p1');
    }).pipe(Effect.provide(TestLayer)));

  it('should add and retrieve team villagers', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);
      const player = createMockPlayer('p1');

      yield* _(service.addTeamVillager(player));
      const villagers = yield* _(service.getTeamVillagers);

      expect(villagers).toHaveLength(1);
      expect(villagers[0].getSocketId()).toBe('p1');
    }).pipe(Effect.provide(TestLayer)));

  it('should manage pending deaths', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);
      const player = createMockPlayer('p1');

      yield* _(service.addPendingDeath(player, 'WEREWOLVES'));
      const inQueue = yield* _(service.isInDeathQueue('p1'));
      expect(inQueue).toBe(true);

      const deaths = yield* _(service.getPendingDeaths);
      expect(deaths).toHaveLength(1);
      expect(deaths[0].cause).toBe('WEREWOLVES');
    }).pipe(Effect.provide(TestLayer)));

  it('should remove pending deaths', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);
      const player = createMockPlayer('p1');

      yield* _(service.addPendingDeath(player));
      const removed = yield* _(service.removePendingDeath('p1'));

      expect(removed).toBeDefined();
      expect(removed?.playerId).toBe('p1');

      const inQueue = yield* _(service.isInDeathQueue('p1'));
      expect(inQueue).toBe(false);
    }).pipe(Effect.provide(TestLayer)));

  it('should heal werewolf victims', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);
      const p1 = createMockPlayer('p1');
      const p2 = createMockPlayer('p2');

      yield* _(service.addPendingDeath(p1, 'WEREWOLVES'));
      yield* _(service.addPendingDeath(p2, 'WITCH_POISON'));

      yield* _(service.healWerewolvesVictim);

      const deaths = yield* _(service.getPendingDeaths);
      expect(deaths).toHaveLength(1);
      expect(deaths[0].cause).toBe('WITCH_POISON');
    }).pipe(Effect.provide(TestLayer)));

  it('should add partner suicide', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);

      yield* _(service.addPartnerSuicide('p1', 'p2'));

      const deaths = yield* _(service.getPendingDeaths);
      expect(deaths).toHaveLength(1);
      expect(deaths[0].cause).toBe('PARTNER_SUICIDE');
      expect(deaths[0].metadata?.loverId).toBe('p2');
    }).pipe(Effect.provide(TestLayer)));

  it('should add hunter revenge', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);

      yield* _(service.addHunterRevenge('p1', 'h1'));

      const deaths = yield* _(service.getPendingDeaths);
      expect(deaths).toHaveLength(1);
      expect(deaths[0].cause).toBe('HUNTER_REVENGE');
      expect(deaths[0].metadata?.hunterId).toBe('h1');
    }).pipe(Effect.provide(TestLayer)));

  it('should add day vote elimination', () =>
    Effect.gen(function* (_) {
      const service = yield* _(DeathManagerService);

      yield* _(service.addDayVoteElimination('p1', 5));

      const deaths = yield* _(service.getPendingDeaths);
      expect(deaths).toHaveLength(1);
      expect(deaths[0].cause).toBe('DAY_VOTE');
      expect(deaths[0].metadata?.voteCount).toBe(5);
    }).pipe(Effect.provide(TestLayer)));
});
