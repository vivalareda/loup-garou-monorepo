import type { Role } from '@repo/types';

/**
 * Builds the role pool for a given player count. From 4 players: about a
 * third werewolves, one each of Cupid, Witch and Hunter, a Seer from 5
 * players up, and villagers in the remaining slots. Below 4, everyone is a
 * villager.
 */
export function buildRolesList(playerCount: number): Role[] {
  const roles: Role[] = [];

  if (playerCount >= 4) {
    const werewolfCount = Math.floor(playerCount / 3) || 1;

    for (let i = 0; i < werewolfCount; i++) {
      roles.push('WEREWOLF');
    }

    roles.push('CUPID');
    roles.push('WITCH');
    roles.push('HUNTER');

    // The Seer joins from 5 players up: at 4 there is no free slot left
    if (playerCount > roles.length) {
      roles.push('SEER');
    }

    const remainingSlots = playerCount - roles.length;

    for (let i = 0; i < remainingSlots; i++) {
      roles.push('VILLAGER');
    }
  } else {
    for (let i = 0; i < playerCount; i++) {
      roles.push('VILLAGER');
    }
  }

  return roles;
}
