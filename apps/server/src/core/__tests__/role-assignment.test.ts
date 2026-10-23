import { describe, expect, it } from 'vitest';
import { buildRolesList } from '@/core/role-assignment';

describe('buildRolesList', () => {
  it('deals only villagers below 4 players', () => {
    expect(buildRolesList(3)).toEqual(['VILLAGER', 'VILLAGER', 'VILLAGER']);
  });

  it('leaves no slot for the Seer at 4 players', () => {
    expect(buildRolesList(4)).toEqual(['WEREWOLF', 'CUPID', 'WITCH', 'HUNTER']);
  });

  it('adds the Seer from 5 players up', () => {
    expect(buildRolesList(5)).toEqual([
      'WEREWOLF',
      'CUPID',
      'WITCH',
      'HUNTER',
      'SEER',
    ]);
  });

  it('scales werewolves to a third and fills the rest with villagers', () => {
    const roles = buildRolesList(9);

    expect(roles).toHaveLength(9);
    expect(roles.filter((r) => r === 'WEREWOLF')).toHaveLength(3);
    expect(roles.filter((r) => r === 'VILLAGER')).toHaveLength(2);
  });
});
