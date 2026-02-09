import type { Role } from '@repo/types';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { initRolesList } from '../role-assignment.js';

const baseCounts: Record<Role, number> = {
  VILLAGER: 0,
  WEREWOLF: 0,
  SEER: 0,
  HUNTER: 0,
  CUPID: 0,
  WITCH: 0,
};

const countRoles = (roles: Role[]): Record<Role, number> => {
  const counts = { ...baseCounts };
  for (const role of roles) {
    counts[role] += 1;
  }
  return counts;
};

// Deterministic RNG so the test is reproducible and never flaky.
// Avoid bitwise ops so linters don't flag it.
const makeRng = (seed: number): (() => number) => {
  const m = 2_147_483_647; // 2^31 - 1 (prime)
  const a = 48_271; // MINSTD multiplier
  let s = ((seed % m) + m) % m;
  if (s === 0) {
    s = 1;
  }

  return () => {
    s = (s * a) % m;
    return s / m;
  };
};

const expectedCounts = (playerCount: number): Record<Role, number> => {
  if (playerCount < 4) {
    return {
      ...baseCounts,
      VILLAGER: playerCount,
    };
  }

  const werewolfCount = Math.floor(playerCount / 3) || 1;
  const cupidCount = 1;
  const witchCount = playerCount >= 6 ? 1 : 0;
  const hunterCount = playerCount >= 8 ? 1 : 0;
  const villagerCount =
    playerCount - (werewolfCount + cupidCount + witchCount + hunterCount);

  return {
    ...baseCounts,
    WEREWOLF: werewolfCount,
    CUPID: cupidCount,
    WITCH: witchCount,
    HUNTER: hunterCount,
    VILLAGER: villagerCount,
  };
};

describe('initRolesList (property-based)', () => {
  it('always returns a valid role multiset for the player count', () => {
    fc.assert(
      fc.property(
        // Keep this small to start; thresholds (4/6/8) still get hammered.
        fc.integer({ min: 0, max: 20 }),
        fc.integer(),
        (playerCount, seed) => {
          const roles = initRolesList(playerCount, makeRng(seed));

          expect(roles).toHaveLength(playerCount);

          const counts = countRoles(roles);
          expect(counts).toEqual(expectedCounts(playerCount));
        }
      ),
      {
        numRuns: 500,
      }
    );
  });
});
