/**
 * All possible causes of death in the Loup-Garou game
 */
export type DeathCause =
  | 'WEREWOLVES' // Killed by werewolves during night phase
  | 'WITCH_POISON' // Poisoned by witch during night phase
  | 'DAY_VOTE' // Eliminated by village vote during day phase
  | 'HUNTER_REVENGE' // Shot by hunter when hunter dies
  | 'PARTNER_SUICIDE'; // Partner dies when their lover dies

export type DeathInfo = {
  playerId: string;
  playerName: string;
  cause: DeathCause;
  timestamp: Date;
  metadata?: {
    hunterId?: string;
    loverId?: string;
    voteCount?: number;
  };
};

export type PendingDeath = {
  playerId: string;
  cause: DeathCause;
  metadata?: DeathInfo['metadata'];
};
