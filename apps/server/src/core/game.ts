import type { PlayerListItem, Role, WerewolvesVoteState } from '@repo/types';
import { DeathManager } from '@/core/death-manager';
import { Player } from '@/core/player';
import type { SocketType } from '@/server/sockets';

export class Game {
  private readonly io: SocketType;
  private readonly players: Map<string, Player>;
  private readonly specialRolePlayers: Map<Role, Player> = new Map();
  private readonly deathManager: DeathManager;
  private readonly lovers: Player[] = [];
  private readonly werewolfVotes: Map<string, string> = new Map(); // voterSid → targetSid

  private availableRoles: Role[] = [];

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
      socketId: player.getSocketId(),
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
    const villagersList = this.deathManager.getTeamVillagers();
    const villagers: PlayerListItem[] = [];

    for (const player of villagersList) {
      villagers.push({
        socketId: player.getSocketId(),
        name: player.getName(),
      });
    }
    return villagers;
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
      this.io.to(player.getSocketId()).emit('player:role-assigned', role);
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

  getPlayerBySocketId(socketId: string) {
    return this.players.get(socketId);
  }

  isWerewolf(socketId: string) {
    const player = this.players.get(socketId);
    return player?.getRole() === 'WEREWOLF';
  }

  isValidTarget(targetSid: string) {
    const target = this.players.get(targetSid);
    return target?.getRole() !== 'WEREWOLF';
  }

  handleWerewolfVote(voterSid: string, targetSid: string) {
    // Validate voter is werewolf
    if (!this.isWerewolf(voterSid)) {
      throw new Error(
        `Player ${voterSid} is not a werewolf and cannot vote during werewolf phase`
      );
    }

    // Store vote (overwrites previous vote if any)
    this.werewolfVotes.set(voterSid, targetSid);
    console.log(`Werewolf ${voterSid} voted for ${targetSid}`);
  }

  handleWerewolfUpdateVote(
    voterSid: string,
    newTargetSid: string,
    oldTargetSid: string
  ) {
    // Validate voter is werewolf
    if (!this.isWerewolf(voterSid)) {
      throw new Error(
        `Player ${voterSid} is not a werewolf and cannot update vote during werewolf phase`
      );
    }

    // Validate new target is not werewolf
    if (!this.isValidTarget(newTargetSid)) {
      throw new Error(
        `Target ${newTargetSid} is not a valid target (cannot vote for werewolves)`
      );
    }

    // Validate old vote exists
    const currentVote = this.werewolfVotes.get(voterSid);
    if (currentVote !== oldTargetSid) {
      throw new Error(
        `Vote mismatch: expected ${oldTargetSid}, but current vote is ${currentVote}`
      );
    }

    // Update vote
    this.werewolfVotes.set(voterSid, newTargetSid);
    console.log(
      `Werewolf ${voterSid} changed vote from ${oldTargetSid} to ${newTargetSid}`
    );
  }

  alertAllWerewolvesOfVotes() {
    for (const werewolf of this.getWerewolfList()) {
      this.io.to(werewolf.getSocketId()).emit('werewolf:voting-complete');
    }
  }

  calculateWerewolfVoteTallies() {
    const tallies: WerewolvesVoteState = {};

    for (const targetSid of this.werewolfVotes.values()) {
      tallies[targetSid] = (tallies[targetSid] || 0) + 1;
    }

    return tallies;
  }

  getWerewolfVoteTallies(): WerewolvesVoteState {
    return this.calculateWerewolfVoteTallies();
  }

  hasAllWerewolvesVoted() {
    const werewolves = this.getWerewolfList();
    const werewolfSids = werewolves.map((werewolf) => werewolf.getSocketId());

    return werewolfSids.every((sid) => this.werewolfVotes.has(sid));
  }

  addPendingDeath(sid: string) {
    const player = this.players.get(sid);

    if (!player) {
      throw new Error(`Player with sid ${sid} not found`);
    }

    this.deathManager.addPendingDeath(player);
  }

  getWerewolfTarget() {
    if (!this.hasAllWerewolvesVoted()) {
      return null;
    }

    const tallies = this.calculateWerewolfVoteTallies();

    let maxVotes = 0;
    let targetSid: string | null = null;

    for (const [playerName, votes] of Object.entries(tallies)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        targetSid = playerName;
      }
    }

    return targetSid;
  }
}
