import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  MockScenario,
  MockScenarioPendingDeath,
  MockScenarioVoteMap,
} from '../mock-scenario';

describe('MockScenario type', () => {
  it('accepts a minimal scenario definition', () => {
    const minimalScenario: MockScenario = {
      index: 2,
      segment: 'LOVERS',
      players: [
        { role: 'CUPID' },
        { role: 'HUNTER' },
        { role: 'VILLAGER' },
        { role: 'WEREWOLF' },
      ],
    };

    expect(minimalScenario.segment).toBe('LOVERS');
    expect(minimalScenario.players).toHaveLength(4);
    expect(minimalScenario.players[3]?.role).toBe('WEREWOLF');
    expect(minimalScenario.lovers).toBeUndefined();
  });

  it('supports optional votes, lovers, and pending deaths', () => {
    const werewolfVotes: MockScenarioVoteMap = {
      3: 1,
      4: 1,
    };
    const dayVotes: MockScenarioVoteMap = {
      0: 2,
      1: 2,
      2: 3,
    };
    const pendingDeaths: MockScenarioPendingDeath[] = [
      { slot: 2, cause: 'WEREWOLVES' },
      { slot: 5, cause: 'DAY_VOTE' },
    ];

    const richScenario = {
      index: 5,
      segment: 'DAY_VOTE',
      players: [
        { role: 'VILLAGER' },
        { role: 'HUNTER', isAlive: false },
        { role: 'VILLAGER' },
        { role: 'WEREWOLF' },
        { role: 'WEREWOLF' },
        { role: 'VILLAGER' },
      ],
      lovers: [0, 5],
      werewolfVotes,
      dayVotes,
      pendingDeaths,
    } satisfies MockScenario;

    expect(richScenario.lovers).toEqual([0, 5]);
    expect(richScenario.pendingDeaths?.[0]?.cause).toBe('WEREWOLVES');
    expect(richScenario.werewolfVotes?.[3]).toBe(1);
    expect(richScenario.players[1]?.isAlive).toBe(false);

    expectTypeOf<MockScenario['lovers']>().toEqualTypeOf<
      readonly [number, number] | undefined
    >();
    expectTypeOf<MockScenario['pendingDeaths']>().toEqualTypeOf<
      readonly MockScenarioPendingDeath[] | undefined
    >();
  });
});
