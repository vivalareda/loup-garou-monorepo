import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { MockScenario } from '../MockScenario.js';

describe('MockScenario Service', () => {
  it.effect('provides lover scenario with correct structure', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const loverScenario = scenarios.LOVERS;

      expect(loverScenario.segment).toBe('CUPID');
      expect(loverScenario.index).toBe(1);
      expect(loverScenario.players).toHaveLength(6);
      expect(loverScenario.loversIndex).toEqual([1, 2]);
    })
  );

  it.effect('provides werewolf scenario with correct structure', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const werewolfScenario = scenarios.WEREWOLF;

      expect(werewolfScenario.segment).toBe('LOVERS');
      expect(werewolfScenario.index).toBe(2);
      expect(werewolfScenario.players).toHaveLength(6);
      expect(werewolfScenario.loversIndex).toBeUndefined();
    })
  );

  it.effect('provides witch scenario with correct structure', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const witchScenario = scenarios.WITCH;

      expect(witchScenario.segment).toBe('WEREWOLF');
      expect(witchScenario.index).toBe(3);
      expect(witchScenario.players).toHaveLength(6);
      expect(witchScenario.werewolvesTargetIndex).toBe(5);
    })
  );

  it.effect('provides day vote scenario with correct structure', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const dayVoteScenario = scenarios.DAY_VOTE;

      expect(dayVoteScenario.segment).toBe('DAY_VOTE');
      expect(dayVoteScenario.index).toBe(4);
      expect(dayVoteScenario.players).toHaveLength(6);
      expect(dayVoteScenario.loversIndex).toEqual([4, 5]);
      expect(dayVoteScenario.pendingDeaths).toBeUndefined();
    })
  );

  it.effect('provides hunter scenario with pending hunter death', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const hunterScenario = scenarios.HUNTER;

      expect(hunterScenario.segment).toBe('DAY_VOTE');
      expect(hunterScenario.index).toBe(4);
      expect(hunterScenario.players).toHaveLength(6);
      expect(hunterScenario.players[3]?.role).toBe('HUNTER');
      expect(hunterScenario.pendingDeaths?.[0]).toEqual({
        slot: 5,
        cause: 'WEREWOLVES',
      });
    })
  );

  it.effect('lover scenario has correct role distribution', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const loverScenario = scenarios.LOVERS;

      const roleCounts = loverScenario.players.reduce(
        (acc, player) => {
          acc[player.role] = (acc[player.role] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      expect(roleCounts.CUPID).toBe(1);
      expect(roleCounts.WEREWOLF).toBe(2);
      expect(roleCounts.VILLAGER).toBe(3);
    })
  );

  it.effect('witch scenario includes WITCH role', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const witchScenario = scenarios.WITCH;

      const hasWitch = witchScenario.players.some(
        (player) => player.role === 'WITCH'
      );

      expect(hasWitch).toBe(true);
    })
  );

  it.effect('all scenarios have 6 players', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;

      expect(scenarios.LOVERS.players).toHaveLength(6);
      expect(scenarios.WEREWOLF.players).toHaveLength(6);
      expect(scenarios.WITCH.players).toHaveLength(6);
      expect(scenarios.DAY_VOTE.players).toHaveLength(6);
      expect(scenarios.HUNTER.players).toHaveLength(6);
    })
  );

  it.effect('all players start alive in scenarios', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;

      const allAlive = Object.values(scenarios).every((scenario) =>
        scenario.players.every(
          (player) => player.isAlive === undefined || player.isAlive === true
        )
      );

      expect(allAlive).toBe(true);
    })
  );

  it.effect('scenarios have correct segment progression', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;

      const segments = [
        scenarios.LOVERS.segment,
        scenarios.WEREWOLF.segment,
        scenarios.WITCH.segment,
        scenarios.DAY_VOTE.segment,
      ];

      expect(segments).toEqual(['CUPID', 'LOVERS', 'WEREWOLF', 'DAY_VOTE']);
    })
  );

  it.effect('scenarios have correct index progression', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;

      expect(scenarios.LOVERS.index).toBe(1);
      expect(scenarios.WEREWOLF.index).toBe(2);
      expect(scenarios.WITCH.index).toBe(3);
      expect(scenarios.DAY_VOTE.index).toBe(4);
    })
  );

  it.effect('day vote scenario has no pending deaths', () =>
    Effect.gen(function* () {
      const scenarios = yield* MockScenario;
      const dayVoteScenario = scenarios.DAY_VOTE;

      expect(dayVoteScenario.werewolvesTargetIndex).toBeUndefined();
      expect(dayVoteScenario.pendingDeaths).toBeUndefined();
    })
  );
});
