import type { Player } from '@/core/player.js';

export type Winner = 'villagers' | 'werewolves' | null;

export const checkIfWinner = (
  players: Player[],
  witchHasHealPotion: boolean,
  witchHasPoisonPotion: boolean
): Winner => {
  const alivePlayers = players.filter((player) => player.isAlive);
  const werewolves = alivePlayers.filter(
    (player) => player.role === 'WEREWOLF'
  );
  const villagers = alivePlayers.filter((player) => player.role !== 'WEREWOLF');

  if (werewolves.length === 0) {
    return 'villagers';
  }

  if (werewolves.length > villagers.length) {
    return 'werewolves';
  }

  if (werewolves.length === villagers.length) {
    const witchHasPotion = witchHasHealPotion || witchHasPoisonPotion;
    const witchAlive = villagers.some((player) => player.role === 'WITCH');

    if (witchHasPotion && witchAlive) {
      return null;
    }

    return 'werewolves';
  }

  return null;
};
