import type { Player } from '@/core/player';

/**
 * The couple bound by Cupid. This class only stores and queries the pair;
 * what happens when a lover dies (partner suicide, hunter chains) is driven
 * by Game's death flow. Lovers are identified by socket ID throughout, since
 * that is how every other part of the game identifies players.
 */
export class Lovers {
  private readonly list: Player[] = [];

  /** Replaces the current couple with the selected players. */
  set(players: Player[]) {
    this.list.length = 0;
    this.list.push(...players);
  }

  clear() {
    this.list.length = 0;
  }

  get(): readonly Player[] {
    return this.list;
  }

  isLover(player: Player) {
    return this.hasPartner(player.getSocketId());
  }

  hasPartner(playerSid: string) {
    return this.list.some((lover) => lover.getSocketId() === playerSid);
  }

  /** The other lover, or undefined when the player is not part of the couple. */
  getPartner(player: Player) {
    if (!this.isLover(player)) {
      return undefined;
    }

    return this.list.find(
      (lover) => lover.getSocketId() !== player.getSocketId()
    );
  }

  isAnyInDeathQueue(isInDeathQueue: (sid: string) => boolean) {
    return this.list.some((lover) => isInDeathQueue(lover.getSocketId()));
  }

  /** The lover who is not queued to die, if any. */
  findSurvivor(isInDeathQueue: (sid: string) => boolean) {
    return this.list.find((lover) => !isInDeathQueue(lover.getSocketId()));
  }
}
