import type { Role } from '@repo/types';

export function initRolesList(
  playerCount: number,
  rng: () => number = Math.random
): Role[] {
  const roles: Role[] = [];

  if (playerCount >= 4) {
    const werewolfCount = Math.floor(playerCount / 3) || 1;

    for (let i = 0; i < werewolfCount; i++) {
      roles.push('WEREWOLF');
    }

    roles.push('CUPID');

    if (playerCount >= 6) {
      roles.push('WITCH');
    }

    if (playerCount >= 8) {
      roles.push('HUNTER');
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

  return shuffleArray(roles, rng);
}

function shuffleArray<T>(array: T[], rng: () => number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
