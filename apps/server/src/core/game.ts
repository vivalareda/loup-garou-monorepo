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

export type DayVoteResult =
  | { kind: 'elimination'; player: Player }
  | { kind: 'tie'; tiedPlayerNames: string[] };

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

  availableRoles: Role[] = [];

  constructor(io: SocketType, deathManager: DeathManager) {
    this.io = io;
    this.deathManager = deathManager;
    this.players = new Map<string, Player>();
    this.lovers = [];
  }

  addPlayer(name: string, sid: string) {
    const player = new Player(name, sid, this.io);
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
      this.availableRoles.push('WITCH');
      // this.availableRoles.push('HUNTER');

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

    // Dev-only: force a specific player to be the hunter by setting
    // DEV_FORCE_HUNTER=<player name> when starting the server
    const forcedHunterName = process.env.DEV_FORCE_HUNTER;

    for (const player of this.players.values()) {
      if (forcedHunterName && player.getName() === forcedHunterName) {
        const role: Role = 'HUNTER';
        player.assignRole(role);
        const hunterIndex = shuffledRoles.indexOf(role);
        // Keep role count in sync with player count whether or not
        // HUNTER was part of the generated role list
        shuffledRoles.splice(hunterIndex !== -1 ? hunterIndex : 0, 1);
        this.setPlayerTeams(player);
        this.setSpecialRolePlayer(player);
        continue;
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

  hasPartner(playerSid: string) {
    for (const lover of this.lovers) {
      if (lover.getSocketId() === playerSid) {
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
    return player.getRole() === 'HUNTER';
  }

  hasAllWerewolvesAgreed() {
    const werewolves = this.getWerewolfList();
    // Only alive werewolves must vote — a disconnected werewolf is treated
    // as dead (handleDisconnect) and must not stall the phase forever.
    const werewolfSids = werewolves
      .filter((werewolf) => werewolf.isAlive)
      .map((werewolf) => werewolf.getSocketId());

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

  getPlayersLover(player: Player) {
    const lover = this.lovers.find((p) => p !== player);

    if (!lover) {
      throw new Error(`lover for ${player.getName()} not found`);
    }

    return lover;
  }

  isHunterVictimInLove(sid: string) {
    const player = this.getPlayerBySocketId(sid);

    if (!player) {
      throw new Error(`${sid} didn't match any player`);
    }

    return this.isPlayerLover(player);
  }

  isHunterInLove() {
    const hunter = this.getSpecialRolePlayer('HUNTER');
    if (!hunter) {
      return;
    }
    const hasLover = this.isPlayerLover(hunter);

    if (hasLover) {
      const lover = this.getPlayersLover(hunter);
      this.addPendingDeath(lover.getSocketId(), 'PARTNER_SUICIDE');
    }
  }

  hunterIsInDeathQueue() {
    const hunterSid = this.getSpecialRolePlayer('HUNTER')?.getSocketId();

    if (!hunterSid) {
      return false;
    }

    return this.deathManager.isInDeathQueue(hunterSid);
  }

  isPartnerHunter() {
    const survivingPartner = this.lovers.find(
      (lover) => !this.deathManager.isInDeathQueue(lover.getSocketId())
    );

    return survivingPartner?.getRole() === 'HUNTER';
  }

  processPendingDeaths() {
    // PASS 1: Identify cascade deaths and add them to the queue
    const initialDeaths = this.deathManager.getPendingDeaths();
    for (const pendingDeath of initialDeaths) {
      const player = this.players.get(pendingDeath.playerId);

      if (!player) {
        throw new Error('error: player not found in processPendingDeaths');
      }

      // Handle partner suicide if one lover dies
      if (
        this.isPlayerLover(player) &&
        pendingDeath.cause !== 'PARTNER_SUICIDE'
      ) {
        const partner = this.getPartner(player);
        if (
          partner?.isAlive &&
          !this.deathManager.isInDeathQueue(partner.getSocketId())
        ) {
          this.deathManager.addPartnerSuicide(
            partner.getSocketId(),
            pendingDeath.playerId
          );
        }
      }
    }

    // PASS 2: Process ALL deaths (original + cascaded)
    const allDeaths = this.deathManager.getPendingDeaths();
    const deathInfos: DeathInfo[] = [];

    for (const pendingDeath of allDeaths) {
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
        ...(pendingDeath.metadata ? { metadata: pendingDeath.metadata } : {}),
      };

      deathInfos.push(deathInfo);

      // Use new unified death handling
      this.handlePlayerDeath(player);

      // Remove the death from the queue as it's been processed
      this.deathManager.removePendingDeath(pendingDeath.playerId);
    }

    return deathInfos;
  }

  getAlivePlayers() {
    return Array.from(this.players.values()).filter((player) => player.isAlive);
  }

  isPlayerLover(player: Player) {
    return this.lovers.includes(player);
  }

  getPartner(player: Player) {
    return this.lovers.find(
      (lover) => lover.getSocketId() !== player.getSocketId()
    );
  }

  assignRandomRoles() {
    this.assignRoles();
  }

  getWerewolves() {
    return Array.from(this.players.values()).filter(
      (player) => player.getRole() === 'WEREWOLF'
    );
  }

  /**
   * @deprecated Use handlePlayerDeath() instead which calls player.kill()
   * This method is kept for backward compatibility but should not be used in new code
   */
  alertPlayerOfDeath(socketId: string) {
    this.io.to(socketId).emit('alert:player-is-dead');
    console.log('alerted player of death');
    this.io.emit('lobby:player-died', socketId);
  }

  handlePlayerDeath(player: Player) {
    player.kill();

    if (player.getRole() === 'WITCH') {
      this.witchHasHealPotion = false;
      this.witchHasPoisonPotion = false;
    }
  }

  /**
   * A player's socket dropped. Treat it as a death (not removal) so the
   * game stays completable: alive counts and win checks keep working, and
   * the leaver's role stays registered so e.g. a disconnected hunter still
   * triggers the dawn revenge flow. Stale vote entries are cleared so the
   * werewolf/day phases don't deadlock waiting on a vote that will never
   * arrive. A disconnected lover's partner gets a PARTNER_SUICIDE queued,
   * flushed by the next dayAction()/dawn run.
   */
  handleDisconnect(socketId: string) {
    const player = this.players.get(socketId);
    if (!player) {
      return; // unknown socket (never joined as a player)
    }

    // Idempotent: a socket.io adapter can emit disconnect twice
    if (!player.isAlive) {
      return;
    }

    console.log(
      `Player ${player.getName()} (${socketId}) disconnected — treating as death`
    );

    this.handlePlayerDeath(player);

    this.werewolfVotes.delete(socketId);
    this.dayVotes.delete(socketId);

    if (this.isPlayerLover(player)) {
      const partner = this.getPartner(player);
      if (partner?.isAlive) {
        this.deathManager.addPartnerSuicide(
          partner.getSocketId(),
          player.getSocketId()
        );
      }
    }
  }

  killHunterRevenge(sid: string) {
    const player = this.players.get(sid);
    const hunterSid = this.getSpecialRolePlayer('HUNTER')?.getSocketId();

    if (!player) {
      throw new Error(`Player with sid ${sid} not found, can't be killed`);
    }

    if (!hunterSid) {
      throw new Error(
        'Tried to kill hunter target but hunter player not found'
      );
    }

    // Track hunter revenge for death cause
    this.deathManager.addHunterRevenge(sid, hunterSid);

    // Kill player immediately (not pending death)
    this.handlePlayerDeath(player);
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

  addPartnerSuicide(loverSid: string, partnerSid: string) {
    this.deathManager.addPartnerSuicide(partnerSid, loverSid);
  }

  witchKill(playerSid: string) {
    this.deathManager.addWitchPoison(playerSid);
    this.witchHasPoisonPotion = false;
    console.log('the witch doesnt have any poisong left');
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

  getDayVoteResult(): DayVoteResult {
    const tallies = this.calculateDayVoteTallies();
    console.log('day vote tallies', tallies);

    const maxVotes = Math.max(0, ...Object.values(tallies));
    const leadingSids = Object.entries(tallies)
      .filter(([, votes]) => votes === maxVotes)
      .map(([sid]) => sid);

    if (maxVotes === 0 || leadingSids.length === 0) {
      throw new Error('No valid target found in day vote');
    }

    if (leadingSids.length > 1) {
      const tiedPlayerNames = leadingSids.map(
        (sid) => this.players.get(sid)?.getName() ?? sid
      );
      return { kind: 'tie', tiedPlayerNames };
    }

    const player = this.players.get(leadingSids[0]);

    if (!player) {
      throw new Error(`Player with sid ${leadingSids[0]} not found`);
    }

    return { kind: 'elimination', player };
  }

  clearDayVotes() {
    this.dayVotes.clear();
  }

  clearWerewolfVotes() {
    this.werewolfVotes.clear();
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
      this.alertLosers('villagers');
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

    // No villagers left means the werewolves have overrun the village. The
    // production loop reaches this state through a lover-grief cascade at
    // dawn (two villagers die at once) and previously deadlocked because the
    // 1-v-1 / 0-werewolf checks below don't catch it. processPendingDeaths
    // drains the whole queue before this runs, so this does NOT short-circuit
    // the grief cascade (the 2-werewolves-+-1-villager mid-cascade state stays
    // `null` and the cascade completes).
    if (villagers.length === 0) {
      return 'werewolves';
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

//   getWerewolfTarget() {
//     if (!this.hasAllWerewolvesAgreed()) {
//       return;
//     }
//
//     const tallies = this.calculateWerewolfVoteTallies();
//
//     let maxVotes = 0;
//     let targetSid: string | null = null;
//
//     for (const [playerName, votes] of Object.entries(tallies)) {
//       if (votes > maxVotes) {
//         maxVotes = votes;
//         targetSid = playerName;
//       }
//     }
//
//     return targetSid;
//   }
//
//   healWerewolfVictim() {
//     this.deathManager.healWerewolvesVictim();
//     this.witchHasHealPotion = false;
//   }
//
//   witchKill(playerSid: string) {
//     this.deathManager.addWitchPoison(playerSid);
//     this.witchHasPoisonPotion = false;
//   }
//
//   canWitchHeal();
//   {
//   return this.
//   witchHasHealPotion;
// }
//
// canWitchPoison();
// {
//   return this.witchHasPoisonPotion;
// }
//
// calculateDayVoteTallies();
// {
//   const tallies: Record<string, number> = {};
//
//   for (const targetSid of this.dayVotes.values()) {
//     tallies[targetSid] = (tallies[targetSid] || 0) + 1;
//   }
//
//   return tallies;
// }
//
// hasAllPlayersVoted();
// {
//   // For simplicity, we can determine this by checking expected number of votes
//   // The frontend will send votes from all eligible players
//   const expectedVoters = Array.from(this.players.keys()).filter((playerId) => {
//     const player = this.players.get(playerId);
//     return player?.isAlive;
//   });
//
//   return this.dayVotes.size === expectedVoters.length;
// }
//
// getDayVoteTarget();
// {
//   const tallies = this.calculateDayVoteTallies();
//   console.log('day vote tallies', tallies);
//
//   let maxVotes = 0;
//   let targetSid: string | null = null;
//   let tieCount = 0;
//
//   // Find player(s) with most votes
//   for (const [playerSid, votes] of Object.entries(tallies)) {
//     if (votes > maxVotes) {
//       maxVotes = votes;
//       targetSid = playerSid;
//       tieCount = 1;
//     } else if (votes === maxVotes && maxVotes > 0) {
//       tieCount++;
//     }
//   }
//
//   // Handle tie case (throw error for now as requested)
//   if (tieCount > 1) {
//     throw new Error('Tie in day vote - will be implemented later');
//   }
//
//   if (!targetSid) {
//     throw new Error('No valid target found in day vote');
//   }
//
//   const player = this.players.get(targetSid);
//
//   if (!player) {
//     throw new Error(`Player with sid ${targetSid} not found`);
//   }
//
//   return player;
// }
//
// handleDayVotePlayer(votedPlayer: Player)
// {
//   if (!votedPlayer) {
//     throw new Error(`Player with sid ${votedPlayer} not found`);
//   }
//
//   votedPlayer.setIsAlive(false);
//
//   // Kill player immediately (not pending death)
//   this.alertPlayerOfDeath(votedPlayer.getSocketId());
//
//   // Clear votes for next round
//   this.dayVotes.clear();
// }
//
// alertWinnersAndLosers(winner: 'villagers' | 'werewolves')
// {
//   if (winner === 'villagers') {
//     for (const player of this.deathManager.getTeamVillagers()) {
//       this.io.to(player.getSocketId()).emit('alert:player-won');
//     }
//     this.alertLosers('werewolves');
//   }
//
//   if (winner === 'werewolves') {
//     for (const player of this.deathManager.getTeamWerewolves()) {
//       this.io.to(player.getSocketId()).emit('alert:player-won');
//     }
//     this.alertLosers('werewolves');
//   }
// }
//
// alertLosers(loser: 'villagers' | 'werewolves')
// {
//   if (loser === 'villagers') {
//     for (const player of this.deathManager.getTeamVillagers()) {
//       this.io.to(player.getSocketId()).emit('alert:player-lost');
//     }
//   }
//
//   if (loser === 'werewolves') {
//     for (const player of this.deathManager.getTeamWerewolves()) {
//       this.io.to(player.getSocketId()).emit('alert:player-lost');
//     }
//   }
// }
//
// checkIfWinner();
// {
//   const villagers = this.deathManager
//     .getTeamVillagers()
//     .filter((p) => p.isAlive);
//   const werewolves = this.deathManager
//     .getTeamWerewolves()
//     .filter((p) => p.isAlive);
//
//   console.log('villagers alive', villagers.length);
//   console.log('werewolves alive', werewolves.length);
//
//   if (werewolves.length === 0) {
//     return 'villagers';
//   }
//
//   if (werewolves.length === 1 && villagers.length === 1) {
//     const lastVillager = villagers[0];
//     if (
//       lastVillager.getRole() === 'WITCH' &&
//       (this.witchHasHealPotion || this.witchHasPoisonPotion)
//     ) {
//       return null; // Game continues
//     }
//     return 'werewolves';
//   }
//
//   return null; // Game continues
// }
// }
