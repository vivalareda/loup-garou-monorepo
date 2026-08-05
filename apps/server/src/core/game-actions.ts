import type { DeathInfo } from '@repo/types';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';
import type { Game } from './game';

function resolveDayDiscussionMs() {
  const raw =
    process.env.DAY_DISCUSSION_MS ?? process.env.DAY_VOTE_DELAY_MS ?? '';
  if (raw === '') {
    return 120_000;
  }
  return Number(raw);
}

export class GameActions {
  private readonly game: Game;
  private readonly io: SocketType;
  private readonly segmentsManager: SegmentsManager;
  private dayVotingOpen = false;
  private discussionTimer: NodeJS.Timeout | null = null;
  private discussionEndsAt: number | null = null;

  constructor(game: Game, io: SocketType, segmentsManager: SegmentsManager) {
    this.game = game;
    this.io = io;
    this.segmentsManager = segmentsManager;
  }

  cupidAction() {
    const cupid = this.game.getSpecialRolePlayer('CUPID');
    const socket = cupid?.getSocketId();
    if (!socket) {
      throw new Error('Cupid player not found');
    }
    this.io.to(socket).emit('cupid:pick-required');
  }

  loversAction() {
    const lovers = this.game.getLovers();
    // Overridable so headless tests don't sit through real-time delays
    const alertDelayMs = Number(process.env.LOVER_ALERT_DELAY_MS ?? 4000);

    // Wait a few seconds before prompting the cupid to pick lovers since lover audio file isn't awaited
    setTimeout(() => {
      this.io
        .to(lovers[0].getSocketId())
        .emit('alert:player-is-lover', lovers[1].getName());
      this.io
        .to(lovers[1].getSocketId())
        .emit('alert:player-is-lover', lovers[0].getName());
    }, alertDelayMs);

    // *This is for the dashboard only* Enable the close button after a delay, like in the mobile app
    setTimeout(
      () => {
        this.io
          .to(lovers[0].getSocketId())
          .emit('alert:lovers-can-close-alert');
        this.io
          .to(lovers[1].getSocketId())
          .emit('alert:lovers-can-close-alert');
      },
      Math.min(alertDelayMs, 3000)
    );
  }

  seerAction() {
    const seer = this.game.getSpecialRolePlayer('SEER');
    if (!seer) {
      return;
    }
    this.io.to(seer.getSocketId()).emit('seer:pick-required');
  }

  werewolfAction() {
    // Clear last night's votes so a werewolf that has since died doesn't
    // leave a stale entry that makes hasAllWerewolvesAgreed() return false
    // forever (the surviving werewolves would never reach agreement).
    this.game.clearWerewolfVotes();
    for (const werewolf of this.game.getWerewolfList()) {
      this.io.to(werewolf.getSocketId()).emit('werewolf:pick-required');
    }
  }

  witchHealAction() {
    const witch = this.game.getSpecialRolePlayer('WITCH');
    const werewolfVictimSid = this.game.getWerewolfTarget();

    if (!witch) {
      console.log('No witch in the game, skipping witch heal action');
      return;
    }

    if (!werewolfVictimSid) {
      throw new Error(
        'No werewolf victim found - werewolves may not have reached agreement'
      );
    }

    this.io.to(witch.getSocketId()).emit('witch:can-heal', werewolfVictimSid);
  }

  witchPoisonAction() {
    const witch = this.game.getSpecialRolePlayer('WITCH');

    console.log(`[WITCH-POISON] Witch found: ${witch === undefined}`);

    if (!witch) {
      console.error('Witch player not found');
      return;
    }

    console.log(
      `[WITCH-POISON] Emitting poison prompt to witch ${witch.getName()}`
    );
    this.io.to(witch.getSocketId()).emit('witch:pick-poison-player');
  }

  handleWerewolfVote(socketId: string, targetPlayer: string) {
    this.game.handleWerewolfVote(socketId, targetPlayer);
  }

  handleWerewolfUpdateVote(
    socketId: string,
    targetPlayer: string,
    oldVote: string
  ) {
    this.game.handleWerewolfUpdateVote(socketId, targetPlayer, oldVote);
  }

  broadcastWerewolfVotes() {
    const voteTallies = this.game.getWerewolfVoteTallies();
    const werewolves = this.game.getWerewolfList();

    for (const werewolf of werewolves) {
      this.io
        .to(werewolf.getSocketId())
        .emit('werewolf:current-votes', voteTallies);
    }
  }

  announceNightDeaths(deaths: DeathInfo[]) {
    this.io.emit('night:deaths-announced', deaths);

    for (const death of deaths) {
      console.log(
        `Announcing death: Player ${death.playerId} died from ${death.cause}`
      );
    }
  }

  async dayAction() {
    this.closeDayVote();
    const deaths = this.game.processPendingDeaths();
    if (deaths.length > 0) {
      this.announceNightDeaths(deaths);
    }

    // Delegate the victory check so the segments manager records the
    // FINISHED state — a local checkIfWinner would end the game without
    // marking it finished, leaving game:restart permanently rejected.
    if (this.segmentsManager.isGameOver()) {
      return;
    }

    const discussionMs = resolveDayDiscussionMs();
    if (!Number.isFinite(discussionMs) || discussionMs <= 0) {
      this.startDayVote();
      return;
    }

    this.discussionEndsAt = Date.now() + discussionMs;
    this.io.emit('game:countdown', 'DAY-DISCUSSION', discussionMs);
    this.discussionTimer = setTimeout(() => this.startDayVote(), discussionMs);
    this.discussionTimer.unref?.();
  }

  /** Open the day vote: ends the discussion window. Idempotent. */
  startDayVote() {
    if (this.dayVotingOpen || !this.segmentsManager.isCurrentSegment('DAY')) {
      return;
    }

    this.clearDiscussionTimer();
    this.dayVotingOpen = true;
    this.io.emit('day:voting-phase-start');

    const remainingMs = this.segmentsManager.getRemainingDeadlineMs();
    if (remainingMs !== null && remainingMs > 0) {
      this.io.emit('game:countdown', 'DAY', remainingMs);
    }
  }

  isDayVotingOpen() {
    return this.dayVotingOpen;
  }

  isDiscussionActive() {
    return this.discussionEndsAt !== null && !this.dayVotingOpen;
  }

  getDiscussionRemainingMs() {
    if (!this.isDiscussionActive() || this.discussionEndsAt === null) {
      return null;
    }
    return Math.max(0, this.discussionEndsAt - Date.now());
  }

  closeDayVote() {
    this.clearDiscussionTimer();
    this.dayVotingOpen = false;
  }

  private clearDiscussionTimer() {
    if (this.discussionTimer) {
      clearTimeout(this.discussionTimer);
      this.discussionTimer = null;
    }
    this.discussionEndsAt = null;
  }

  hunterAction() {
    // Emit only to the dead Hunter, not every connected client — other
    // players (and spectators) must not see the revenge-pick prompt.
    const hunter = this.game.getSpecialRolePlayer('HUNTER');
    if (hunter) {
      this.io.to(hunter.getSocketId()).emit('hunter:pick-required');
    }
  }
}
