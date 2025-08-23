import type { Player } from '@/core/player';

export class DeathManager {
  private readonly teamWerewolves: Player[] = [];
  private readonly teamVillagers: Player[] = [];
  private readonly pendingDeath: Player[] = [];

  constructor() {
    this.teamWerewolves = [];
    this.teamVillagers = [];
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

  addPendingDeath(player: Player) {
    this.pendingDeath.push(player);
  }
}
