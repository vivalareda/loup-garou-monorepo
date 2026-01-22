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

/**
 * Pure function to check win conditions based on alive player counts
 * @param aliveWerewolves - Number of alive werewolves
 * @param aliveVillagers - Number of alive villagers
 * @param witchHasPotions - Whether the witch has any potions remaining
 * @returns 'villagers' if villagers won, 'werewolves' if werewolves won, null if game continues
 */
export const checkWinner = (
  aliveWerewolves: number,
  aliveVillagers: number,
  witchHasPotions: boolean
): Winner => {
  // Villagers win if all werewolves are dead
  if (aliveWerewolves === 0) {
    return 'villagers';
  }

  // Werewolves win if they outnumber villagers
  if (aliveWerewolves > aliveVillagers) {
    return 'werewolves';
  }

  // Equal numbers - check if witch can still influence the game
  if (aliveWerewolves === aliveVillagers) {
    // Game continues if witch has potions to tip the balance
    if (witchHasPotions) {
      return null;
    }
    // Werewolves win if no witch potions remain
    return 'werewolves';
  }

  // Game continues if villagers outnumber werewolves
  return null;
};
