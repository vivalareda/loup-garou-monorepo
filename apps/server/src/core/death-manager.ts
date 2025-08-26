import type { DeathCause, PendingDeath } from '@repo/types';
import type { Player } from '@/core/player';

export class DeathManager {
  private readonly teamWerewolves: Player[] = [];
  private readonly teamVillagers: Player[] = [];
  private readonly pendingDeaths: Map<string, PendingDeath> = new Map();

  constructor() {
    this.teamWerewolves = [];
    this.teamVillagers = [];
    this.pendingDeaths = new Map();
  }

  addTeamWerewolf(player: Player) {
    this.teamWerewolves.push(player);
  }

  addTeamVillager(player: Player) {
    this.teamVillagers.push(player);
  }

  getTeamWerewolves(): Player[] {
    return this.teamWerewolves;
  }

  getTeamVillagers(): Player[] {
    return this.teamVillagers;
  }

  addPendingDeath(player: Player, cause: DeathCause = 'WEREWOLVES') {
    const pendingDeath: PendingDeath = {
      playerId: player.getSocketId(),
      cause,
    };
    this.pendingDeaths.set(player.getSocketId(), pendingDeath);
  }

  removePendingDeath(playerId: string) {
    const pendingDeath = this.pendingDeaths.get(playerId);
    if (pendingDeath) {
      this.pendingDeaths.delete(playerId);
      return pendingDeath;
    }
  }

  getPendingDeaths() {
    return Array.from(this.pendingDeaths.values());
  }

  healWerewolvesVictim() {
    for (const [playerId, death] of this.pendingDeaths.entries()) {
      if (death.cause === 'WEREWOLVES') {
        this.pendingDeaths.delete(playerId);
      }
    }
  }

  addLoverSuicide(loverId: string, deadLoverId: string) {
    const pendingDeath: PendingDeath = {
      playerId: loverId,
      cause: 'LOVER_SUICIDE',
      metadata: { loverId: deadLoverId },
    };
    this.pendingDeaths.set(loverId, pendingDeath);
  }

  addHunterRevenge(victimId: string, hunterId: string) {
    const pendingDeath: PendingDeath = {
      playerId: victimId,
      cause: 'HUNTER_REVENGE',
      metadata: { hunterId },
    };
    this.pendingDeaths.set(victimId, pendingDeath);
  }

  addDayVoteElimination(victimId: string, voteCount: number) {
    const pendingDeath: PendingDeath = {
      playerId: victimId,
      cause: 'DAY_VOTE',
      metadata: { voteCount },
    };
    this.pendingDeaths.set(victimId, pendingDeath);
  }

  addWitchPoison(victimId: string) {
    const pendingDeath: PendingDeath = {
      playerId: victimId,
      cause: 'WITCH_POISON',
    };
    this.pendingDeaths.set(victimId, pendingDeath);
  }
}
