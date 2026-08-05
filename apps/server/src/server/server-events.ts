import type {
  ClientToServerEvents,
  Countdown,
  GamePhase,
  PendingPrompt,
  PlayerGameSnapshot,
  ServerToClientEvents,
} from '@repo/types';
import type { Socket } from 'socket.io';
import { resolvePlayerCount } from '@/config';
import type { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { MockScenario } from '@/segments/mock-scenario';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

/**
 * How long a disconnected player keeps their seat before the game treats
 * the disconnect as a death (same consequences as before: votes cleared,
 * a lover's partner grieves). Long enough to cover a locked phone or an
 * app hop plus the socket.io reconnect backoff.
 */
function resolveDisconnectGraceMs() {
  const raw = process.env.DISCONNECT_GRACE_MS;
  if (raw === undefined || raw === '') {
    return 90_000;
  }
  return Number(raw);
}

export class GameEvents {
  private readonly io: SocketType;
  private readonly game: Game;
  private readonly eventsActions: EventsActions;
  private readonly segmentsManager: SegmentsManager;
  private readonly requiredPlayerCount = resolvePlayerCount();
  private pendingLoverAcks = new Set<string>();
  /** Grace timers for disconnected players, keyed by session token. */
  private readonly graceTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    game: Game,
    segmentsManager: SegmentsManager,
    io: SocketType,
    eventActions: EventsActions
  ) {
    this.io = io;
    this.eventsActions = eventActions;
    this.game = game;
    this.segmentsManager = segmentsManager;
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      socket.on('player:join', (name: string) => {
        this.handlePlayerJoin(socket, name);
      });

      socket.on('game:restart', () => {
        if (!this.segmentsManager.hasFinished()) {
          socket.emit('alert:action-error', 'Game is not finished');
          return;
        }
        console.log(`🔄 Game restart requested by ${socket.id}`);
        this.resetGame();
      });

      socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        this.handleTransportDisconnect(socket.id);
      });

      // Admin/Dashboard events for testing
      socket.on('admin:start-game', () => {
        if (this.segmentsManager.hasStarted()) {
          socket.emit('alert:action-error', 'Game already started');
          return;
        }
        console.log('🎮 Admin starting game manually');
        this.game.assignRandomRoles();
        this.game.alertPlayersOfRoles();
        this.io.emit('lobby:villagers-list', this.game.getVillagersList());
        this.segmentsManager.startGame();
      });

      socket.on('admin:next-segment', () => {
        if (this.segmentsManager.hasFinished()) {
          socket.emit('alert:action-error', 'Game is finished');
          return;
        }
        console.log('⏭ Admin advancing to next segment');
        this.segmentsManager.finishSegment();
      });

      socket.on('admin:simulate-werewolf-vote', (targetPlayer: string) => {
        console.log(`🐺 Admin simulating werewolf vote for: ${targetPlayer}`);
        const werewolves = this.game.getWerewolves();
        for (const werewolf of werewolves) {
          this.game.handleWerewolfVote(werewolf.getSocketId(), targetPlayer);
        }
        this.segmentsManager.getGameActions().broadcastWerewolfVotes();

        if (this.game.hasAllWerewolvesAgreed()) {
          const victim = this.game.getWerewolfTarget();
          if (!victim) {
            throw new Error('The victim does not exist, this is not normal');
          }
          this.game.addPendingDeath(victim, 'WEREWOLVES');
          this.segmentsManager.finishSegment();
        }
      });

      socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
        console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
        // For now, just log - day voting will be implemented later
      });

      this.setupGettersEvents(socket);
      this.setupCupidEvents(socket);
      this.setupLoversEvents(socket);
      this.setupSeerEvents(socket);
      this.setupWerewolfEvents(socket);
      this.setupWitchEvents(socket);
      this.setupDayVoteEvents(socket);
      this.setupHunterEvents(socket);
      this.setupMockEvents(socket);
    });
  }

  setupGettersEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('lobby:get-players-list', () => {
      const playersArray = this.game.getClientPlayerList();
      socket.emit('lobby:players-list', playersArray, this.requiredPlayerCount);
    });

    socket.on('agent:get-state', (callback) => {
      const player = this.game.getPlayerBySocketId(socket.id);
      if (!player) {
        callback({
          phase: this.segmentsManager.getCurrentSegmentType(),
          players: this.game.getRosterForClient(),
          self: { type: 'waiting', name: '', socketId: socket.id },
        });
        return;
      }
      callback(this.buildSnapshotFor(player));
    });

    socket.on('player:rejoin', (sessionToken: string) => {
      const previousSid = this.game
        .getPlayerBySessionToken(sessionToken)
        ?.getSocketId();
      const player = this.game.reconnectPlayer(sessionToken, socket.id);
      if (!player) {
        socket.emit('player:rejoin-failed');
        return;
      }

      this.completeRejoin(player, previousSid, socket);
    });
  }

  private handlePlayerJoin(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    name: string
  ) {
    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      socket.emit('lobby:join-rejected', 'Invalid name');
      return;
    }

    if (this.segmentsManager.hasStarted()) {
      // Same name, disconnected seat → this is the player coming back
      // (lost token, reloaded app, different phone). Restore, don't reject.
      if (this.reclaimSeatByName(trimmedName, socket)) {
        return;
      }
      socket.emit('lobby:join-rejected', 'Game already started');
      return;
    }

    if (this.game.getPlayerBySocketId(socket.id)) {
      socket.emit('lobby:join-rejected', 'Player already joined');
      return;
    }

    if (this.game.getPlayerList().size >= this.requiredPlayerCount) {
      socket.emit('lobby:join-rejected', 'Game is full');
      return;
    }

    // Unique names keep the reclaim-seat-by-name recovery unambiguous
    if (this.isNameTaken(trimmedName)) {
      socket.emit('lobby:join-rejected', 'Name already taken');
      return;
    }

    const player = this.game.addPlayer(trimmedName, socket.id);
    socket.emit('lobby:player-data', player.getWaitingRoomData());
    socket.broadcast.emit(
      'lobby:update-players-list',
      player.getPlayerForClient()
    );
    console.log(
      `Player joined: ${trimmedName} (ID: ${socket.id}), player count: ${this.game.getPlayerList()}`
    );

    if (this.game.getPlayerList().size === this.requiredPlayerCount) {
      this.game.assignRoles();
      this.game.alertPlayersOfRoles();
      this.io.emit('lobby:villagers-list', this.game.getVillagersList());
      this.segmentsManager.startGame();
    }
  }

  private isNameTaken(trimmedName: string) {
    const wanted = trimmedName.toLowerCase();
    return Array.from(this.game.getPlayerList().values()).some(
      (candidate) => candidate.getName().trim().toLowerCase() === wanted
    );
  }

  /**
   * Fallback recovery when the session token is gone (reloaded app, new
   * phone): typing the SAME name mid-game reclaims that seat, but only
   * while its owner is disconnected — a connected player's seat cannot be
   * stolen by name.
   */
  private reclaimSeatByName(
    name: string,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    const wanted = name.trim().toLowerCase();
    const match = Array.from(this.game.getPlayerList().values()).find(
      (candidate) => candidate.getName().trim().toLowerCase() === wanted
    );

    if (!match || match.isConnected) {
      return false;
    }

    const previousSid = match.getSocketId();
    const player = this.game.reconnectPlayer(match.sessionToken, socket.id);
    if (!player) {
      return false;
    }

    console.log(`Player ${player.getName()} reclaimed their seat by name`);
    this.completeRejoin(player, previousSid, socket);
    return true;
  }

  /** Shared tail of both recovery paths (token rejoin and name reclaim). */
  private completeRejoin(
    player: Player,
    previousSid: string | undefined,
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    this.clearGraceTimer(player.sessionToken);

    // A pending lover acknowledgement follows the player to the new socket
    if (previousSid && this.pendingLoverAcks.delete(previousSid)) {
      this.pendingLoverAcks.add(socket.id);
    }

    console.log(
      `Player ${player.getName()} reconnected (${previousSid} → ${socket.id})`
    );

    socket.emit('game:snapshot', this.buildSnapshotFor(player));

    // Their socket ID changed: refresh every client's roster and the
    // werewolves' target list so stale IDs don't reject future actions
    this.io.emit(
      'lobby:players-list',
      this.game.getClientPlayerList(),
      this.requiredPlayerCount
    );
    if (this.segmentsManager.hasStarted()) {
      this.io.emit('lobby:villagers-list', this.game.getVillagersList());
    }

    // A wolf coming back mid-vote also needs the current tallies
    if (
      this.segmentsManager.isCurrentSegment('WEREWOLF') &&
      player.role === 'WEREWOLF'
    ) {
      this.segmentsManager.getGameActions().broadcastWerewolfVotes();
    }
  }

  setupCupidEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
      const cupid = this.game.getSpecialRolePlayer('CUPID');
      if (
        !cupid ||
        cupid.getSocketId() !== socket.id ||
        !cupid.isAlive ||
        !this.segmentsManager.isCurrentSegment('CUPID')
      ) {
        socket.emit('alert:action-error', 'Cupid action is not allowed now');
        console.warn(`cupid:lovers-pick rejected from ${socket.id}`);
        return;
      }

      if (!this.isValidCupidSelection(selectedPlayers, cupid.getSocketId())) {
        socket.emit('alert:action-error', 'Invalid Cupid selection');
        console.warn(`cupid:lovers-pick rejected from ${socket.id} (bad payload)`);
        return;
      }

      this.game.setLovers(selectedPlayers);
      this.pendingLoverAcks = new Set(selectedPlayers);
      this.segmentsManager.finishSegment();
    });
  }

  private isValidCupidSelection(selectedPlayers: string[], cupidSid: string) {
    if (selectedPlayers.length !== 2) {
      return false;
    }

    const uniquePlayers = new Set(selectedPlayers);
    if (uniquePlayers.size !== 2 || uniquePlayers.has(cupidSid)) {
      return false;
    }

    return selectedPlayers.every((sid) => {
      const player = this.game.getPlayerBySocketId(sid);
      return player?.isAlive === true;
    });
  }

  setupLoversEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('alert:lover-closed-alert', () => {
      if (!this.segmentsManager.isCurrentSegment('LOVERS')) {
        socket.emit('alert:action-error', 'Lover acknowledgement is not allowed now');
        return;
      }

      if (!this.pendingLoverAcks.delete(socket.id)) {
        console.warn(`alert:lover-closed-alert ignored from ${socket.id}`);
        return;
      }

      if (this.pendingLoverAcks.size === 0) {
        this.segmentsManager.finishSegment();
      }
    });
  }

  setupSeerEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('seer:picked-player', (targetSid: string) => {
      const seer = this.game.getSpecialRolePlayer('SEER');
      if (
        !this.segmentsManager.isCurrentSegment('SEER') ||
        !seer ||
        seer.getSocketId() !== socket.id ||
        !seer.isAlive
      ) {
        socket.emit('alert:action-error', 'Seer action is not allowed now');
        console.warn(`seer:picked-player rejected from ${socket.id}`);
        return;
      }

      const target = this.game.getPlayerBySocketId(targetSid);
      if (!target || !target.isAlive || target === seer) {
        socket.emit('alert:action-error', 'Invalid Seer target');
        console.warn(`seer:picked-player rejected: invalid target ${targetSid}`);
        return;
      }

      socket.emit('seer:vision-result', target.getName(), target.getRole());
      this.segmentsManager.finishSegment();
    });
  }

  setupWerewolfEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('werewolf:player-voted', (targetPlayer: string) => {
      if (!this.isLivingWerewolfSender(socket)) {
        return;
      }

      if (!this.isValidWerewolfTarget(targetPlayer)) {
        socket.emit('alert:action-error', 'Invalid werewolf target');
        return;
      }

      this.eventsActions.handleWerewolfVote(socket.id, targetPlayer);
    });

    socket.on(
      'werewolf:player-update-vote',
      (targetPlayer: string, oldVote: string) => {
        if (!this.isLivingWerewolfSender(socket)) {
          return;
        }

        if (!this.isValidWerewolfTarget(targetPlayer)) {
          socket.emit('alert:action-error', 'Invalid werewolf target');
          return;
        }

        if (this.game.getWerewolfVoteOf(socket.id) !== oldVote) {
          socket.emit('alert:action-error', 'Vote is out of date');
          console.warn(
            `werewolf:player-update-vote rejected from ${socket.id} (stale oldVote)`
          );
          return;
        }

        this.game.handleWerewolfUpdateVote(socket.id, targetPlayer, oldVote);
        this.eventsActions.tryCompleteWerewolfVote();
      }
    );
  }

  /**
   * Sender guard for the werewolf vote events. Rejecting instead of letting
   * Game throw matters for reconnects: a client that emitted while offline
   * flushes those events from its NEW socket before `player:rejoin` lands,
   * and an unknown sender must not crash the process.
   */
  private isLivingWerewolfSender(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    if (!this.segmentsManager.isCurrentSegment('WEREWOLF')) {
      socket.emit('alert:action-error', 'Werewolf vote is not allowed now');
      return false;
    }

    const voter = this.game.getPlayerBySocketId(socket.id);
    if (!voter || !voter.isAlive || voter.role !== 'WEREWOLF') {
      socket.emit('alert:action-error', 'Werewolf vote is not allowed now');
      console.warn(
        `werewolf vote rejected from ${socket.id} (not a living werewolf)`
      );
      return false;
    }

    return true;
  }

  private isValidWerewolfTarget(targetSid: string) {
    const target = this.game.getPlayerBySocketId(targetSid);
    return !!target && target.isAlive && target.getRole() !== 'WEREWOLF';
  }

  setupWitchEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('witch:healed-player', () => {
      const witch = this.game.getSpecialRolePlayer('WITCH');
      if (
        !this.segmentsManager.isCurrentSegment('WITCH-HEAL') ||
        !witch ||
        witch.getSocketId() !== socket.id ||
        !this.game.canWitchHeal()
      ) {
        socket.emit('alert:action-error', 'Witch heal is not allowed now');
        console.warn(`witch:healed-player rejected from ${socket.id}`);
        return;
      }
      this.game.healWerewolfVictim();
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:poisoned-player', (playerSid: string) => {
      const witch = this.game.getSpecialRolePlayer('WITCH');
      const target = this.game.getPlayerBySocketId(playerSid);
      if (
        !this.segmentsManager.isCurrentSegment('WITCH-POISON') ||
        !witch ||
        witch.getSocketId() !== socket.id ||
        !this.game.canWitchPoison() ||
        !target ||
        !target.isAlive
      ) {
        socket.emit('alert:action-error', 'Witch poison is not allowed now');
        console.warn(`witch:poisoned-player rejected from ${socket.id}`);
        return;
      }
      this.game.witchKill(playerSid);
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:skipped-heal', () => {
      const witch = this.game.getSpecialRolePlayer('WITCH');
      if (
        !this.segmentsManager.isCurrentSegment('WITCH-HEAL') ||
        !witch ||
        witch.getSocketId() !== socket.id
      ) {
        socket.emit('alert:action-error', 'Witch heal is not allowed now');
        console.warn(`witch:skipped-heal rejected from ${socket.id}`);
        return;
      }
      console.log('🧙 Witch skipped heal action');
      this.segmentsManager.finishSegment();
    });

    socket.on('witch:skipped-poison', () => {
      const witch = this.game.getSpecialRolePlayer('WITCH');
      if (
        !this.segmentsManager.isCurrentSegment('WITCH-POISON') ||
        !witch ||
        witch.getSocketId() !== socket.id
      ) {
        socket.emit('alert:action-error', 'Witch poison is not allowed now');
        console.warn(`witch:skipped-poison rejected from ${socket.id}`);
        return;
      }
      console.log('🧙 Witch skipped poison action');
      this.segmentsManager.finishSegment();
    });
  }

  setupDayVoteEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('day:player-voted', (targetPlayer: string) => {
      if (
        !this.segmentsManager.isCurrentSegment('DAY') ||
        !this.segmentsManager.getGameActions().isDayVotingOpen()
      ) {
        socket.emit('alert:action-error', 'Day vote is not allowed now');
        return;
      }

      this.eventsActions.handleDayVote(socket.id, targetPlayer);
    });

    socket.on('day:start-vote', () => {
      const gameActions = this.segmentsManager.getGameActions();
      const player = this.game.getPlayerBySocketId(socket.id);
      if (
        !player?.isAlive ||
        !this.segmentsManager.isCurrentSegment('DAY') ||
        !gameActions.isDiscussionActive()
      ) {
        socket.emit('alert:action-error', 'Cannot start the vote now');
        return;
      }

      console.log(`☀ ${player.getName()} ended the discussion early`);
      gameActions.startDayVote();
    });
  }

  setupHunterEvents(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>
  ) {
    socket.on('hunter:killed-player', (targetSid: string) => {
      const hunter = this.game.getSpecialRolePlayer('HUNTER');
      const target = this.game.getPlayerBySocketId(targetSid);
      if (!hunter || hunter.getSocketId() !== socket.id) {
        console.warn(`hunter:killed-player rejected from ${socket.id} (not hunter)`);
        return;
      }

      if (
        !target ||
        !target.isAlive ||
        target.getSocketId() === hunter.getSocketId() ||
        target.getRole() === 'HUNTER'
      ) {
        console.warn(`hunter:killed-player rejected: invalid target ${targetSid}`);
        return;
      }

      if (!this.eventsActions.submitHunterPick(targetSid)) {
        socket.emit('alert:action-error', 'Hunter pick is not allowed now');
        console.warn(
          `hunter pick for ${targetSid} received but no resolution is waiting`
        );
      }
    });
  }

  setupMockEvents(socket: Socket<ClientToServerEvents, ServerToClientEvents>) {
    socket.on('admin:mock-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillHunter();
    });

    socket.on('admin:mock-lover-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLover();
    });

    socket.on('admin:mock-lover-second-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLoverSecondIsHunter();
    });

    socket.on('admin:mock-lover-is-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runWerewolfKillLoverWhoIsHunter();
    });

    socket.on('admin:mock-day-vote-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillHunter();
    });

    socket.on('admin:mock-day-vote-lover-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLover();
    });

    socket.on('admin:mock-day-vote-lover-is-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLoverWhoIsHunter();
    });

    socket.on('admin:mock-day-vote-lover-second-hunter-event', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runDayVoteKillLoverSecondIsHunter();
    });

    socket.on('admin:mock-hunter-revenge-kills-lover', () => {
      const mockScenario = new MockScenario(
        this.game,
        this.segmentsManager,
        this.io,
        this.eventsActions
      );
      mockScenario.runHunterRevengeKillsLover();
    });
  }

  /**
   * A socket dropped. Before the game starts the player simply leaves the
   * lobby; during a game they keep their seat for a grace period (they are
   * not required for phase completion while gone), and only when the grace
   * expires does the previous disconnect-equals-death policy apply.
   */
  private handleTransportDisconnect(socketId: string) {
    const player = this.game.getPlayerBySocketId(socketId);
    if (!player?.isAlive) {
      return;
    }

    if (!this.segmentsManager.hasStarted()) {
      // Lobby: free the seat so the room isn't stuck waiting on a ghost
      this.game.removePlayer(socketId);
      this.io.emit('lobby:player-died', socketId);
      console.log(`Player ${player.getName()} left the lobby`);
      return;
    }

    if (this.segmentsManager.hasFinished()) {
      this.game.markDisconnected(socketId);
      return;
    }

    this.game.markDisconnected(socketId);
    console.log(
      `Player ${player.getName()} (${socketId}) disconnected — grace period started`
    );

    // Their absence may be exactly what completes the current phase
    this.reevaluatePhaseCompletion();

    const graceMs = resolveDisconnectGraceMs();
    if (!Number.isFinite(graceMs) || graceMs <= 0) {
      this.expireGrace(player.sessionToken);
      return;
    }

    this.clearGraceTimer(player.sessionToken);
    const timer = setTimeout(
      () => this.expireGrace(player.sessionToken),
      graceMs
    );
    timer.unref?.();
    this.graceTimers.set(player.sessionToken, timer);
  }

  /** The grace ran out: the disconnect now counts as a death. */
  private expireGrace(sessionToken: string) {
    this.clearGraceTimer(sessionToken);
    const player = this.game.getPlayerBySessionToken(sessionToken);
    if (!player || player.isConnected || !player.isAlive) {
      return;
    }

    console.log(
      `Grace period expired for ${player.getName()} — treating as death`
    );
    this.game.handleDisconnect(player.getSocketId());

    // A dead lover can no longer acknowledge the lovers alert
    if (
      this.pendingLoverAcks.delete(player.getSocketId()) &&
      this.pendingLoverAcks.size === 0 &&
      this.segmentsManager.isCurrentSegment('LOVERS')
    ) {
      this.segmentsManager.finishSegment();
    }

    this.reevaluatePhaseCompletion();
  }

  private clearGraceTimer(sessionToken: string) {
    const timer = this.graceTimers.get(sessionToken);
    if (timer) {
      clearTimeout(timer);
      this.graceTimers.delete(sessionToken);
    }
  }

  /**
   * A player just left the required set (disconnected or died): the phase
   * they were being waited on for may now be complete. The segment deadline
   * remains the last-resort fallback for anything not handled here.
   */
  private reevaluatePhaseCompletion() {
    switch (this.segmentsManager.getCurrentSegmentType()) {
      case 'WEREWOLF':
        this.eventsActions.tryCompleteWerewolfVote();
        break;

      case 'DAY':
        this.eventsActions.tryCompleteDayVote().catch((error) => {
          console.error('day vote completion after disconnect failed:', error);
        });
        break;

      case 'WITCH-HEAL':
      case 'WITCH-POISON': {
        // Only a dead witch skips the phase; one merely in her grace period
        // may still come back and act before the segment deadline
        const witch = this.game.getSpecialRolePlayer('WITCH');
        if (!witch?.isAlive) {
          this.segmentsManager.finishSegment();
        }
        break;
      }

      case 'SEER': {
        const seer = this.game.getSpecialRolePlayer('SEER');
        if (!seer?.isAlive) {
          this.segmentsManager.finishSegment();
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Everything a reconnecting player is allowed to know, including the
   * action they still owe the current phase. Never contains another
   * player's role or private state.
   */
  buildSnapshotFor(player: Player): PlayerGameSnapshot {
    const phase = this.segmentsManager.getCurrentSegmentType();
    const self = player.role
      ? {
          type: 'game' as const,
          name: player.getName(),
          socketId: player.getSocketId(),
          sessionToken: player.sessionToken,
          isAlive: player.isAlive,
          role: player.getRole(),
        }
      : player.getWaitingRoomData();

    const partner = this.game.isPlayerLover(player)
      ? this.game.getPartner(player)
      : undefined;
    const gameResult = this.game.getLastGameResult();

    return {
      phase,
      players: this.game.getRosterForClient(),
      self,
      ...(partner ? { loverName: partner.getName() } : {}),
      ...(phase === 'FINISHED' && gameResult
        ? {
            gameResult,
            didWin:
              (gameResult.winningFaction === 'werewolves') ===
              (player.role === 'WEREWOLF'),
          }
        : {}),
      ...this.buildCountdown(phase),
      ...this.buildPendingPrompt(player, phase),
    };
  }

  private buildCountdown(phase: GamePhase): { countdown?: Countdown } {
    const discussionMs = this.segmentsManager
      .getGameActions()
      .getDiscussionRemainingMs();
    if (phase === 'DAY' && discussionMs !== null) {
      return { countdown: { phase: 'DAY-DISCUSSION', remainingMs: discussionMs } };
    }

    const remainingMs = this.segmentsManager.getRemainingDeadlineMs();
    if (remainingMs === null || phase === 'LOBBY' || phase === 'FINISHED') {
      return {};
    }
    return { countdown: { phase, remainingMs } };
  }

  private buildPendingPrompt(
    player: Player,
    phase: GamePhase
  ): { pendingPrompt?: PendingPrompt } {
    const prompt = this.resolvePendingPrompt(player, phase);
    return prompt ? { pendingPrompt: prompt } : {};
  }

  private resolvePendingPrompt(
    player: Player,
    phase: GamePhase
  ): PendingPrompt | undefined {
    if (!player.isAlive) {
      return;
    }

    switch (phase) {
      case 'CUPID':
        return this.cupidPrompt(player);
      case 'LOVERS':
        return this.loversPrompt(player);
      case 'SEER':
        return player.role === 'SEER' ? { kind: 'SEER' } : undefined;
      case 'WEREWOLF':
        return player.role === 'WEREWOLF' ? { kind: 'WEREWOLF' } : undefined;
      case 'WITCH-HEAL':
        return this.witchHealPrompt(player);
      case 'WITCH-POISON':
        return player.role === 'WITCH' && this.game.canWitchPoison()
          ? { kind: 'WITCH-POISON' }
          : undefined;
      case 'DAY':
        return this.dayPrompt(player);
      case 'HUNTER':
        return this.hunterPrompt(player);
      default:
        return;
    }
  }

  private cupidPrompt(player: Player): PendingPrompt | undefined {
    const cupid = this.game.getSpecialRolePlayer('CUPID');
    return cupid === player && this.game.getLovers().length === 0
      ? { kind: 'CUPID' }
      : undefined;
  }

  private loversPrompt(player: Player): PendingPrompt | undefined {
    if (!this.pendingLoverAcks.has(player.getSocketId())) {
      return;
    }
    const partner = this.game.getPartner(player);
    return partner
      ? { kind: 'LOVERS', partnerName: partner.getName() }
      : undefined;
  }

  private witchHealPrompt(player: Player): PendingPrompt | undefined {
    const victimSid = this.game.getWerewolfTarget();
    if (player.role !== 'WITCH' || !this.game.canWitchHeal() || !victimSid) {
      return;
    }
    const victim = this.game.getPlayerBySocketId(victimSid);
    return {
      kind: 'WITCH-HEAL',
      victimSid,
      victimName: victim?.getName() ?? victimSid,
    };
  }

  private dayPrompt(player: Player): PendingPrompt | undefined {
    // Both death-chain resolutions pause for the hunter inside the DAY
    // segment; a reconnecting hunter must get his pick back, not a vote
    const hunterPrompt = this.hunterPrompt(player);
    if (hunterPrompt) {
      return hunterPrompt;
    }
    if (!this.segmentsManager.getGameActions().isDayVotingOpen()) {
      return;
    }
    return this.game.hasPlayerDayVoted(player.getSocketId())
      ? undefined
      : { kind: 'DAY-VOTE' };
  }

  private hunterPrompt(player: Player): PendingPrompt | undefined {
    return player.role === 'HUNTER' && this.eventsActions.hasPendingHunterPick()
      ? { kind: 'HUNTER' }
      : undefined;
  }

  /**
   * In-place reset of all per-game state, keeping every socket handler and
   * handler object alive. Used by the phone play-again flow and the keyboard
   * `r` shortcut. Players are removed so everyone goes through the join flow
   * again — clients are told via `game:restarted` to return to the lobby.
   */
  resetGame() {
    this.game.resetForNewGame();
    this.game.removeAllPlayers();
    this.segmentsManager.resetForNewGame();
    this.pendingLoverAcks.clear();
    for (const timer of this.graceTimers.values()) {
      clearTimeout(timer);
    }
    this.graceTimers.clear();
    this.io.emit('game:restarted');
  }

  cleanup() {
    this.io.removeAllListeners();
    this.pendingLoverAcks.clear();
    this.setupSocketHandlers();
  }
}
