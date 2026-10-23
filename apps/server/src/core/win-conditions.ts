export type Winner = 'villagers' | 'werewolves';

/**
 * Decides the winner once queued deaths have resolved, from the living team
 * sizes and whether the witch can still use a potion. Returns null while the
 * game should go on.
 */
export function checkWinner(params: {
  totalPlayers: number;
  pendingDeathCount: number;
  livingVillagerCount: number;
  livingWerewolfCount: number;
  witchCanStillAct: boolean;
}): Winner | null {
  const {
    totalPlayers,
    pendingDeathCount,
    livingVillagerCount,
    livingWerewolfCount,
    witchCanStillAct,
  } = params;

  // The game is only decided once every queued death has been resolved:
  // alive counts are meaningless while victims are still in the queue
  if (pendingDeathCount > 0) {
    return null;
  }

  // An empty lobby has no winner; a total wipe still counts as a village
  // win below — eradicating the werewolves is the village's win condition
  if (totalPlayers === 0) {
    return null;
  }

  if (livingWerewolfCount === 0) {
    return 'villagers';
  }

  // Parity: wolves control every day vote from here, unless a living
  // witch can still swing the numbers at night with a potion
  if (livingWerewolfCount >= livingVillagerCount) {
    return witchCanStillAct ? null : 'werewolves';
  }

  return null;
}
