import { describe, expect, it } from '@effect/vitest';
import type { Role } from '@repo/types';
import { initRolesList } from '../role-assignment.js';

const baseCounts: Record<Role, number> = {
  VILLAGER: 0,
  WEREWOLF: 0,
  SEER: 0,
  HUNTER: 0,
  CUPID: 0,
  WITCH: 0,
};

const fixedRng = () => 0.99;

const countRoles = (roles: Role[]): Record<Role, number> => {
  const counts = { ...baseCounts };
  for (const role of roles) {
    counts[role] += 1;
  }
  return counts;
};

describe('initRolesList', () => {
  it('assigns villagers only below minimum players', () => {
    const roles = initRolesList(3, fixedRng);

    expect(roles).toHaveLength(3);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      VILLAGER: 3,
    });
  });

  it('assigns roles for 4 players', () => {
    const roles = initRolesList(4, fixedRng);

    expect(roles).toHaveLength(4);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      WEREWOLF: 1,
      CUPID: 1,
      VILLAGER: 2,
    });
  });

  it('assigns roles for 5 players', () => {
    const roles = initRolesList(5, fixedRng);

    expect(roles).toHaveLength(5);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      WEREWOLF: 1,
      CUPID: 1,
      VILLAGER: 3,
    });
  });

  it('adds the witch at 6 players', () => {
    const roles = initRolesList(6, fixedRng);

    expect(roles).toHaveLength(6);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      WEREWOLF: 2,
      CUPID: 1,
      WITCH: 1,
      VILLAGER: 2,
    });
  });

  it('adds the hunter at 8 players', () => {
    const roles = initRolesList(8, fixedRng);

    expect(roles).toHaveLength(8);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      WEREWOLF: 2,
      CUPID: 1,
      WITCH: 1,
      HUNTER: 1,
      VILLAGER: 3,
    });
  });

  it('scales werewolves and villagers at 10 players', () => {
    const roles = initRolesList(10, fixedRng);

    expect(roles).toHaveLength(10);
    expect(countRoles(roles)).toEqual({
      ...baseCounts,
      WEREWOLF: 3,
      CUPID: 1,
      WITCH: 1,
      HUNTER: 1,
      VILLAGER: 4,
    });
  });

  it('shuffles role order with provided rng', () => {
    const rngValues = [0.9, 0.1, 0.0];
    const rng = () => {
      const value = rngValues.shift();
      if (value === undefined) {
        throw new Error('rng was called too many times');
      }
      return value;
    };

    const roles = initRolesList(4, rng);

    expect(roles).toEqual(['CUPID', 'VILLAGER', 'WEREWOLF', 'VILLAGER']);
  });
});
