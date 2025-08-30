import type {
  DeathCause,
  DeathInfo,
  PlayerListItem,
  Role,
  WerewolvesVoteState,
} from '@repo/types';
import type { DeathManager } from '@/core/death-manager';
import { Player } from '@/core/player';
import type { SocketType } from '@/server/sockets';

export class Game {
  private readonly io: SocketType;
  private readonly players: Map<string, Player>;
  private readonly specialRolePlayers: Map<Role, Player> = new Map();
  private readonly deathManager: DeathManager;
  private readonly lovers: Player[] = [];
  private readonly werewolfVotes: Map<string, string> = new Map(); // voterSid → targetSid
  private readonly dayVotes: Map<string, string> = new Map(); // voterSid → targetSid
  private witchHasHealPotion = true;
  private witchHasPoisonPotion = true;

  private availableRoles: Role[] = [];

  constructor(io: SocketType, deathManager: DeathManager) {
    this.io = io;
    this.deathManager = deathManager;
    this.players = new Map<string, Player>();
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

  getSpecialRolePlayer(role: Role) {
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

  getDeathQueue() {
    return this.deathManager.getPendingDeaths();
  }

  assignRoles() {
    this.initRolesList();
    const shuffledRoles = this.shuffleArray(this.availableRoles);
    console.log(`Shuffled roles: ${shuffledRoles}`);

    // TODO: remove this for testing only
    for (const player of this.players.values()) {
      if (player.getName() === 'Reda') {
        const role: Role = 'HUNTER';
        player.assignRole(role);
        shuffledRoles.splice(shuffledRoles.indexOf(role), 1);
        this.setPlayerTeams(player);
        this.setSpecialRolePlayer(player);
        return;
      }
      const role = shuffledRoles.pop();
      if (!role) {
        throw new Error('No roles available to assign, this shouldnt happen');
      }

      player.assignRole(role);
      this.setSpecialRolePlayer(player);
      this.setPlayerTeams(player);
    }
  }

  setSpecialRolePlayer(player: Player) {
    const role = player.getRole();

    if (role === 'WEREWOLF' || role === 'VILLAGER') {
      return;
    }

    this.specialRolePlayers.set(role, player);
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

  setPlayerTeams(player: Player) {
    if (player.getRole() === 'WEREWOLF') {
      this.deathManager.addTeamWerewolf(player);
      return;
    }

    this.deathManager.addTeamVillager(player);
  }

  isAnyOfLoverHunter() {
    for (const lover of this.lovers) {
      if (lover.getRole() === 'HUNTER') {
        return true;
      }
    }
    return false;
  }

  isOneOfLoversInDeathQueue() {
    for (const lover of this.lovers) {
      if (this.deathManager.isInDeathQueue(lover.getSocketId())) {
        return true;
      }
    }
    return false;
  }

  isOneOfLoversHunter() {
    for (const lover of this.lovers) {
      if (lover.getRole() === 'HUNTER') {
        return true;
      }
    }
    return false;
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

    // Broadcast updated votes to all werewolves
    this.broadcastWerewolfVotes();
  }

  handleDayVote(voterSid: string, targetSid: string) {
    // Store vote (overwrites previous vote if any)
    this.dayVotes.set(voterSid, targetSid);
    console.log(`Player ${voterSid} voted to eliminate ${targetSid}`);
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

    // Broadcast updated votes to all werewolves
    this.broadcastWerewolfVotes();
  }

  handleAllWerewolvesAgree() {
    const victim = this.getWerewolfTarget();
    console.log('victim is', victim);
    if (!victim) {
      throw new Error('The victim does not exist, this is not normal');
    }
    console.log('calling add pending death');
    this.addPendingDeath(victim, 'WEREWOLVES');
    this.alertAllWerewolvesOfVotes();
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

  broadcastWerewolfVotes() {
    const voteTallies = this.getWerewolfVoteTallies();
    const werewolves = this.getWerewolfList();

    for (const werewolf of werewolves) {
      this.io
        .to(werewolf.getSocketId())
        .emit('werewolf:current-votes', voteTallies);
    }
  }

  isPlayerHunter(player: Player) {
    if (player.getRole() !== 'HUNTER') {
      return true;
    }
    return false;
  }

  hasAllWerewolvesAgreed() {
    const werewolves = this.getWerewolfList();
    const werewolfSids = werewolves.map((werewolf) => werewolf.getSocketId());

    // Check if all werewolves have voted
    const allVoted = werewolfSids.every((sid) => this.werewolfVotes.has(sid));
    if (!allVoted) {
      return false;
    }

    // Check if they all agree (all votes are for the same target)
    const votes = Array.from(this.werewolfVotes.values());
    const firstVote = votes[0];
    return votes.every((vote) => vote === firstVote);
  }

  updateHunterPlayerList() {
    for (const player of this.deathManager.getPendingDeaths()) {
      this.io.emit('lobby:player-died', player.playerId);
    }
  }

  hunterIsInDeathQueue() {
    const hunterSid = this.getSpecialRolePlayer('HUNTER')?.getSocketId();
    if (!hunterSid) {
      return false;
    }

    return this.deathManager.isInDeathQueue(hunterSid);
  }

  isLoverHunter() {
    const pendingDeaths = this.deathManager.getPendingDeaths();

    return this.lovers.some((lover) =>
      pendingDeaths.some((death) => death.playerId === lover.getSocketId())
    );
  }

  processPendingDeaths() {
    const pendingDeaths = this.deathManager.getPendingDeaths();
    console.log('Processing pending deaths:', pendingDeaths);

    const deathInfos: DeathInfo[] = [];

    // Process each death (remove players, handle lover suicides, etc.)
    for (const pendingDeath of pendingDeaths) {
      const player = this.players.get(pendingDeath.playerId);

      if (!player) {
        throw new Error('error: player not found in processPendingDeaths');
      }
      // Create DeathInfo from PendingDeath
      const deathInfo: DeathInfo = {
        playerId: pendingDeath.playerId,
        playerName: player.getName(),
        cause: pendingDeath.cause,
        timestamp: new Date(),
        metadata: pendingDeath.metadata,
      };

      deathInfos.push(deathInfo);
      player.setIsAlive(false);

      this.alertPlayerOfDeath(player.getSocketId());

      if (player.getRole() === 'WITCH') {
        this.witchHasHealPotion = false;
        this.witchHasPoisonPotion = false;
      }

      // Handle lover suicide if one lover dies
      if (
        this.isPlayerLover(player) &&
        pendingDeath.cause !== 'LOVER_SUICIDE'
      ) {
        const otherLover = this.lovers.find(
          (lover) => lover.getSocketId() !== player.getSocketId()
        );
        if (otherLover?.isAlive) {
          otherLover.setIsAlive(false);
          this.alertPlayerOfDeath(player.getSocketId());
          const loverDeathInfo: DeathInfo = {
            playerId: otherLover.getSocketId(),
            playerName: otherLover.getName(),
            cause: 'LOVER_SUICIDE',
            timestamp: new Date(),
            metadata: { loverId: pendingDeath.playerId },
          };
          deathInfos.push(loverDeathInfo);
          this.alertPlayerOfDeath(otherLover.getSocketId());
        }
      }
    }

    return deathInfos;
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter((player) => player.isAlive);
  }

  isPlayerLover(player: Player) {
    return this.lovers.includes(player);
  }

  assignRandomRoles() {
    this.assignRoles();
  }

  getWerewolves() {
    return Array.from(this.players.values()).filter(
      (player) => player.getRole() === 'WEREWOLF'
    );
  }

  alertPlayerOfDeath(socketId: string) {
    this.io.to(socketId).emit('alert:player-is-dead');
    console.log('alerted player of death');
    this.io.emit('lobby:player-died', socketId);
  }

  killHunterRevenge(sid: string) {
    const player = this.players.get(sid);
    const hunterSid = this.getSpecialRolePlayer('HUNTER')?.getSocketId();

    if (!player) {
      throw new Error(`Player with sid ${sid} not found, can't be killed`);
    }

    if (!hunterSid) {
      throw new Error(
        'Tried to kill hunter targer but hunter player not found'
      );
    }

    this.deathManager.addHunterRevenge(sid, hunterSid);
    this.alertPlayerOfDeath(sid);
  }

  addPendingDeath(sid: string, cause: DeathCause) {
    const player = this.players.get(sid);

    if (!player) {
      throw new Error(
        `Player with sid ${sid} not found, can't add to pending deaths`
      );
    }

    this.deathManager.addPendingDeath(player, cause);
  }

  getWerewolfTarget() {
    if (!this.hasAllWerewolvesAgreed()) {
      return;
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

  healWerewolfVictim() {
    this.deathManager.healWerewolvesVictim();
    this.witchHasHealPotion = false;
  }

  witchKill(playerSid: string) {
    this.deathManager.addWitchPoison(playerSid);
    this.witchHasPoisonPotion = false;
  }

  canWitchHeal() {
    return this.witchHasHealPotion;
  }

  canWitchPoison() {
    return this.witchHasPoisonPotion;
  }

  calculateDayVoteTallies() {
    const tallies: Record<string, number> = {};

    for (const targetSid of this.dayVotes.values()) {
      tallies[targetSid] = (tallies[targetSid] || 0) + 1;
    }

    return tallies;
  }

  hasAllPlayersVoted() {
    // For simplicity, we can determine this by checking expected number of votes
    // The frontend will send votes from all eligible players
    const expectedVoters = Array.from(this.players.keys()).filter(
      (playerId) => {
        const player = this.players.get(playerId);
        return player?.isAlive;
      }
    );

    return this.dayVotes.size === expectedVoters.length;
  }

  getDayVoteTarget() {
    const tallies = this.calculateDayVoteTallies();
    console.log('day vote tallies', tallies);

    let maxVotes = 0;
    let targetSid: string | null = null;
    let tieCount = 0;

    // Find player(s) with most votes
    for (const [playerSid, votes] of Object.entries(tallies)) {
      if (votes > maxVotes) {
        maxVotes = votes;
        targetSid = playerSid;
        tieCount = 1;
      } else if (votes === maxVotes && maxVotes > 0) {
        tieCount++;
      }
    }

    // Handle tie case (throw error for now as requested)
    if (tieCount > 1) {
      throw new Error('Tie in day vote - will be implemented later');
    }

    if (!targetSid) {
      throw new Error('No valid target found in day vote');
    }

    const player = this.players.get(targetSid);

    if (!player) {
      throw new Error(`Player with sid ${targetSid} not found`);
    }

    return player;
  }

  handleDayVotePlayer(votedPlayer: Player) {
    if (!votedPlayer) {
      throw new Error(`Player with sid ${votedPlayer} not found`);
    }

    votedPlayer.setIsAlive(false);

    // Kill player immediately (not pending death)
    this.alertPlayerOfDeath(votedPlayer.getSocketId());

    // Clear votes for next round
    this.dayVotes.clear();
  }

  alertWinnersAndLosers(winner: 'villagers' | 'werewolves') {
    if (winner === 'villagers') {
      for (const player of this.deathManager.getTeamVillagers()) {
        this.io.to(player.getSocketId()).emit('alert:player-won');
      }
      this.alertLosers('werewolves');
    }

    if (winner === 'werewolves') {
      for (const player of this.deathManager.getTeamWerewolves()) {
        this.io.to(player.getSocketId()).emit('alert:player-won');
      }
      this.alertLosers('werewolves');
    }
  }

  alertLosers(loser: 'villagers' | 'werewolves') {
    if (loser === 'villagers') {
      for (const player of this.deathManager.getTeamVillagers()) {
        this.io.to(player.getSocketId()).emit('alert:player-lost');
      }
    }

    if (loser === 'werewolves') {
      for (const player of this.deathManager.getTeamWerewolves()) {
        this.io.to(player.getSocketId()).emit('alert:player-lost');
      }
    }
  }

  checkIfWinner() {
    const villagers = this.deathManager
      .getTeamVillagers()
      .filter((p) => p.isAlive);
    const werewolves = this.deathManager
      .getTeamWerewolves()
      .filter((p) => p.isAlive);

    console.log('villagers alive', villagers.length);
    console.log('werewolves alive', werewolves.length);

    if (werewolves.length === 0) {
      return 'villagers';
    }

    if (werewolves.length === 1 && villagers.length === 1) {
      const lastVillager = villagers[0];
      if (
        lastVillager.getRole() === 'WITCH' &&
        (this.witchHasHealPotion || this.witchHasPoisonPotion)
      ) {
        return null; // Game continues
      }
      return 'werewolves';
    }

    return null; // Game continues
  }
}
