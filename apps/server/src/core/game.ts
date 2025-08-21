import type { PlayerListItem, Role } from '@repo/types';
import { DeathManager } from '@/core/death-manager';
import { Player } from '@/core/player';
import type { SocketType } from '@/server/sockets';

export class Game {
  private readonly io: SocketType;
  private readonly players: Map<string, Player>;
  private readonly specialRolePlayers: Map<Role, Player> = new Map();
  private readonly deathManager: DeathManager;
  private readonly lovers: Player[] = [];
  private availableRoles: Role[] = [];
  private werewolvesVote: Map<string, number> = new Map();

  constructor(io: SocketType) {
    this.io = io;
    this.players = new Map<string, Player>();
    this.deathManager = new DeathManager();
    this.lovers = [];
  }

  addPlayer(name: string, sid: string) {
    const player = new Player(name, sid);
    this.players.set(sid, player);
    console.log(
      `new players list: ${JSON.stringify(Array.from(this.players.keys()))}`
    );
    return player;
  }

  getClientPlayerList(): PlayerListItem[] {
    return Array.from(this.players.values()).map((player) => ({
      name: player.getName(),
      sid: player.getSocket(),
    }));
  }

  initRolesList() {
    const playerCount = this.players.size;
    this.availableRoles = [];

    if (playerCount >= 4) {
      const werewolfCount = Math.floor(playerCount / 3) || 1;

      for (let i = 0; i < werewolfCount; i++) {
        this.availableRoles.push('WEREWOLF');
      }

      // this.availableRoles.push('SEER');
      this.availableRoles.push('CUPID');

      if (playerCount >= 6) {
        this.availableRoles.push('WITCH');
      }

      if (playerCount >= 8) {
        this.availableRoles.push('HUNTER');
        this.availableRoles.push('CUPID');
      }

      const remainingSlots = playerCount - this.availableRoles.length;
      for (let i = 0; i < remainingSlots; i++) {
        this.availableRoles.push('VILLAGER');
      }
    } else {
      for (let i = 0; i < this.players.size; i++) {
        this.availableRoles.push('VILLAGER');
      }
    }
  }

  getPlayerList() {
    return this.players;
  }

  getVillagersList() {
    const list = this.deathManager.getTeamVillagers();
    return list.map((player) => player.getName());
  }

  getSpecialRolePlayers(role: Role) {
    return this.specialRolePlayers.get(role);
  }

  shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  assignRoles() {
    this.initRolesList();
    const shuffledRoles = this.shuffleArray(this.availableRoles);
    console.log(`Shuffled roles: ${shuffledRoles}`);

    // TODO: remove this for testing only
    for (const player of this.players.values()) {
      // if (player.getName() === 'reda') {
      //   const role = 'CUPID';
      //   player.assignRole(role);
      //   shuffledRoles.splice(shuffledRoles.indexOf(role), 1);
      //   this.setPlayerTeams(role, player);
      // } else {
      //   player.assignRole('VILLAGER');
      //   this.setPlayerTeams('VILLAGER', player);
      // }
      const role = shuffledRoles.pop();
      if (!role) {
        throw new Error('No roles available to assign, this shouldnt happen');
      }

      player.assignRole(role);
      this.setPlayerTeams(role, player);
    }
  }

  alertPlayersOfRoles() {
    for (const player of this.players.values()) {
      const role = player.getRole();
      console.log(`Assigning role ${role} to player ${player.getName()}`);
      if (!role) {
        return;
      }
      this.io.to(player.getSocket()).emit('player:role-assigned', role);
    }
  }

  getWerewolfList() {
    return this.deathManager.getTeamWerewolves();
  }

  setPlayerTeams(roleName: Role, player: Player) {
    switch (roleName) {
      case 'VILLAGER':
        this.deathManager.addTeamVillager(player);
        return;
      case 'WEREWOLF':
        this.deathManager.addTeamWerewolf(player);
        break;
      case 'SEER':
        this.specialRolePlayers.set('SEER', player);
        this.deathManager.addTeamVillager(player);
        break;
      case 'HUNTER':
        this.specialRolePlayers.set('HUNTER', player);
        this.deathManager.addTeamVillager(player);
        break;
      case 'CUPID':
        this.specialRolePlayers.set('CUPID', player);
        this.deathManager.addTeamVillager(player);
        break;
      case 'WITCH':
        this.specialRolePlayers.set('WITCH', player);
        this.deathManager.addTeamVillager(player);
        break;
      default:
        throw new Error(`Unknown role: ${roleName satisfies never}`);
    }
  }

  setLovers(selectedPlayers: string[]) {
    for (const sid of selectedPlayers) {
      const player = this.players.get(sid);
      if (!player) {
        throw new Error(`Player with sid ${sid} not found`);
      }
      this.lovers.push(player);
    }
  }

  getLovers() {
    return this.lovers;
  }

  handleWerewolfVote(targetSid: string) {
    const count = this.werewolvesVote.get(targetSid) || 0;
    this.werewolvesVote.set(targetSid, count + 1);
  }

  getWerewolvesVotes() {}
}
