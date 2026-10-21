import type { GamePhase, Segment } from '@repo/types';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import {
  type GameGeneration,
  ignoreStaleGame,
} from '@/segments/game-generation';
import type { Broadcaster } from '@/server/broadcaster';
import { NightDawnResolution } from '@/server/night-dawn-resolution';

/**
 * Per-segment deadline defaults. Each is overridable by its own env var;
 * SEGMENT_TIMEOUT_MS overrides all of them at once (used by tests and
 * headless simulations). A resolved value <= 0 disables the deadline.
 */
const SEGMENT_TIMEOUTS: Record<string, { defaultMs: number; envVar: string }> =
  {
    CUPID: { defaultMs: 120_000, envVar: 'CUPID_TIMEOUT_MS' },
    LOVERS: { defaultMs: 60_000, envVar: 'LOVERS_TIMEOUT_MS' },
    SEER: { defaultMs: 60_000, envVar: 'SEER_TIMEOUT_MS' },
    WEREWOLF: { defaultMs: 120_000, envVar: 'WEREWOLF_TIMEOUT_MS' },
    'WITCH-HEAL': { defaultMs: 60_000, envVar: 'WITCH_HEAL_TIMEOUT_MS' },
    'WITCH-POISON': { defaultMs: 60_000, envVar: 'WITCH_POISON_TIMEOUT_MS' },
    // A family argues for a while before voting — leave them room
    DAY: { defaultMs: 600_000, envVar: 'DAY_VOTE_TIMEOUT_MS' },
    HUNTER: { defaultMs: 60_000, envVar: 'HUNTER_TIMEOUT_MS' },
  };

export function resolveSegmentTimeoutMs(segmentType: string): number {
  const config = SEGMENT_TIMEOUTS[segmentType];

  const rawValue =
    (config ? process.env[config.envVar] : undefined) ??
    process.env.SEGMENT_TIMEOUT_MS;

  if (rawValue === undefined || rawValue === '') {
    return config?.defaultMs ?? 60_000;
  }

  return Number(rawValue);
}

export class SegmentsManager {
  io: Broadcaster;
  game: Game;
  gameActions: GameActions;
  nightDawnResolution: NightDawnResolution;
  audioManager: AudioManager;
  currentSegment: number;
  segments: Segment[] = [];
  specialScenarios: SpecialScenarios;
  private gameStarted = false;
  private gameFinished = false;

  private cupidSegment!: Segment;
  private loversSegment!: Segment;
  private seerSegment!: Segment;
  private werewolfSegment!: Segment;
  private witchHealSegment!: Segment;
  private witchPoisonSegment!: Segment;
  private daySegment!: Segment;
  private hunterSegment!: Segment;
  private segmentDeadline: NodeJS.Timeout | null = null;
  /**
   * Bumped when the game finishes or is reset. Anything that awaits
   * (narration, a hunter pick) or runs on a timer captures it first and
   * gives up if it changed: that work belongs to a game that is over.
   * Shared with the AudioManager, which checks it after every clip.
   */
  private readonly generation: GameGeneration;
  /** Bumped each time the game moves to another segment. */
  private segmentRun = 0;
  /** The segment run being ended by an `advanceSegment` in progress. */
  private endingRun: number | null = null;
  private deadlineEndsAt: number | null = null;

  constructor(
    game: Game,
    io: Broadcaster,
    audioManager: AudioManager,
    specialScenarios: SpecialScenarios
  ) {
    this.io = io;
    this.game = game;
    this.audioManager = audioManager;
    this.generation = audioManager.generation;
    this.gameActions = new GameActions(game, io, this);
    this.nightDawnResolution = new NightDawnResolution(game, this, io);
    this.specialScenarios = specialScenarios;
    this.currentSegment = 0;
    this.initializeSegments();
  }

  initializeSegment(segment: Segment) {
    this.segments.push(segment);
  }

  getGameActions() {
    return this.gameActions;
  }

  witchDied() {
    this.witchHealSegment.skip = true;
    this.witchPoisonSegment.skip = true;
  }

  initializeSegments() {
    this.segments = [];
    this.cupidSegment = {
      type: 'CUPID',
      action: () => this.gameActions.cupidAction(),
      skip: false,
    };

    this.loversSegment = {
      type: 'LOVERS',
      action: () => this.gameActions.loversAction(),
      skip: false,
    };

    this.seerSegment = {
      type: 'SEER',
      action: () => this.gameActions.seerAction(),
      skip: false,
    };

    this.werewolfSegment = {
      type: 'WEREWOLF',
      action: () => this.gameActions.werewolfAction(),
      skip: false,
    };

    this.witchHealSegment = {
      type: 'WITCH-HEAL',
      action: () => this.gameActions.witchHealAction(),
      skip: false,
    };

    this.witchPoisonSegment = {
      type: 'WITCH-POISON',
      action: () => this.gameActions.witchPoisonAction(),
      skip: false,
    };

    this.daySegment = {
      type: 'DAY',
      action: () => this.gameActions.dayAction(),
      skip: false,
    };

    this.hunterSegment = {
      type: 'HUNTER',
      action: () => this.gameActions.hunterAction(),
      skip: true,
    };

    this.initializeSegment(this.cupidSegment);
    this.initializeSegment(this.loversSegment);
    this.initializeSegment(this.seerSegment);
    this.initializeSegment(this.werewolfSegment);
    this.initializeSegment(this.witchHealSegment);
    this.initializeSegment(this.witchPoisonSegment);
    this.initializeSegment(this.daySegment);
    this.initializeSegment(this.hunterSegment);
  }

  startGame() {
    if (this.gameStarted) {
      return;
    }

    this.gameStarted = true;
    this.gameFinished = false;
    //TODO: add intro back audio (need to put async in front of firstNightSegment)
    // await this.playAudio('Intro');
    this.playSegment();
  }

  findValidSegment() {
    while (
      this.currentSegment < this.segments.length &&
      this.segments[this.currentSegment].skip
    ) {
      this.currentSegment++;
    }

    if (this.currentSegment >= this.segments.length) {
      this.currentSegment = 0;

      while (
        this.currentSegment < this.segments.length &&
        this.segments[this.currentSegment].skip
      ) {
        this.currentSegment++;
      }
    }
  }

  isFirstNightSegment(type: string) {
    return type === 'CUPID' || type === 'LOVERS';
  }

  markFirstNightSegment(segment: Segment) {
    if (!this.isFirstNightSegment(segment.type)) {
      return;
    }

    segment.skip = true;
  }

  getCurrentSegmentType(): GamePhase {
    if (this.gameFinished) {
      return 'FINISHED';
    }

    if (!this.gameStarted) {
      return 'LOBBY';
    }

    const segment = this.segments[this.currentSegment];

    return segment.type;
  }

  isCurrentSegment(type: string) {
    return this.getCurrentSegmentType() === type;
  }

  hasStarted() {
    return this.gameStarted;
  }

  hasFinished() {
    return this.gameFinished;
  }

  resetForNewGame() {
    this.generation.bump();
    this.segmentRun++;
    this.clearDeadline();
    this.gameActions.closeDayVote();
    this.currentSegment = 0;
    this.gameStarted = false;
    this.gameFinished = false;
    this.initializeSegments();
  }

  isHunterInDeathQueue() {
    return this.game.hunterIsInDeathQueue();
  }

  markWitchPoisonAsSkipped() {
    this.witchPoisonSegment.skip = true;
  }

  isOneOfLoversInDeathQueue() {
    return this.game.isOneOfLoversInDeathQueue();
  }

  getGeneration() {
    return this.generation.current();
  }

  /** Runs `listener` whenever a game finishes or is reset. */
  onGameEnded(listener: () => void) {
    this.generation.onBump(listener);
  }

  /** False once the game `generation` was captured in has ended. */
  isCurrentGeneration(generation: number) {
    return this.generation.isCurrent(generation);
  }

  /** Plays narration; false if its game ended meanwhile (`StaleGame`). */
  private async narrate(narration: Promise<void>) {
    try {
      await narration;

      return true;
    } catch (error) {
      ignoreStaleGame(error);

      return false;
    }
  }

  async playSegment() {
    const run = this.segmentRun;
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);
    this.io.emit('game:phase-changed', this.getCurrentSegmentType());

    if (this.shouldAutoSkipSegment(segment.type)) {
      await this.advanceSegment({ playEndAudio: false });

      return;
    }

    if (segment.type === 'DAY') {
      // Dawn (night-death reveal + day start) runs as one resolution
      // program; it pauses internally when the hunter must pick
      this.scheduleDeadline(segment.type);
      this.nightDawnResolution.run().catch((error) => {
        console.error('night dawn resolution failed:', error);
      });

      return;
    }

    const narrated = await this.narrate(
      this.audioManager.playSegmentAudio(segment.type, true)
    );

    // Reset, finished, or already moved past (admin:next-segment) while
    // the intro played
    if (!narrated || run !== this.segmentRun) {
      return;
    }

    segment.action();
    this.scheduleDeadline(segment.type);
  }

  private shouldAutoSkipSegment(segmentType: string) {
    if (segmentType === 'SEER') {
      const seer = this.game.getSpecialRolePlayer('SEER');

      return !seer || !seer.isAlive;
    }

    if (segmentType === 'WITCH-HEAL') {
      const witch = this.game.getSpecialRolePlayer('WITCH');

      return (
        !witch ||
        !witch.isAlive ||
        !this.game.canWitchHeal() ||
        !this.game.getWerewolfTarget()
      );
    }

    if (segmentType === 'WITCH-POISON') {
      const witch = this.game.getSpecialRolePlayer('WITCH');

      return !witch || !witch.isAlive || !this.game.canWitchPoison();
    }

    return false;
  }

  private scheduleDeadline(segmentType: string) {
    const timeoutMs = resolveSegmentTimeoutMs(segmentType);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return;
    }

    this.clearDeadline();
    this.deadlineEndsAt = Date.now() + timeoutMs;

    if (segmentType !== 'DAY') {
      // DAY announces its own countdowns: first the discussion window,
      // then the vote's remaining time
      this.io.emit('game:countdown', segmentType as GamePhase, timeoutMs);
    }

    this.segmentDeadline = setTimeout(() => {
      if (this.getCurrentSegmentType() !== segmentType) {
        return;
      }

      console.warn(`[SEGMENT] ${segmentType} timed out; applying fallback`);
      void this.handleSegmentTimeout(segmentType);
    }, timeoutMs);
    this.segmentDeadline.unref?.();
  }

  private clearDeadline() {
    if (this.segmentDeadline) {
      clearTimeout(this.segmentDeadline);
      this.segmentDeadline = null;
    }

    this.deadlineEndsAt = null;
  }

  getRemainingDeadlineMs() {
    if (this.deadlineEndsAt === null) {
      return null;
    }

    return Math.max(0, this.deadlineEndsAt - Date.now());
  }

  private async handleSegmentTimeout(segmentType: string) {
    this.io.emit('game:phase-timed-out', segmentType as GamePhase);

    if (segmentType === 'DAY') {
      // Whatever partial votes exist are dropped: nobody dies, the night
      // begins. Matches the nobody-dies tie rule in spirit.
      this.game.clearDayVotes();
    }

    if (segmentType === 'CUPID' && this.game.getLovers().length === 0) {
      const cupidSid = this.game.getSpecialRolePlayer('CUPID')?.getSocketId();

      const lovers = this.game
        .getAlivePlayers()
        .filter((player) => player.getSocketId() !== cupidSid)
        .slice(0, 2)
        .map((player) => player.getSocketId());

      if (lovers.length === 2) {
        this.game.setLovers(lovers);
      }
    }

    await this.advanceSegment({ playEndAudio: false });
  }

  isGameOver() {
    const winner = this.game.checkIfWinner();

    if (winner === 'villagers') {
      this.audioManager.playVillagersWonAudio().catch(ignoreStaleGame);
      this.game.alertWinnersAndLosers(winner);
      this.markFinished();

      return true;
    }

    if (winner === 'werewolves') {
      this.audioManager.playWerewolvesWonAudio().catch(ignoreStaleGame);
      this.game.alertWinnersAndLosers(winner);
      this.markFinished();

      return true;
    }

    return false;
  }

  /**
   * Ends the game and stops its clocks: a pending deadline or day
   * discussion would otherwise outlive it (the DAY one by up to 10 min)
   * and keep a Durable Object awake for nothing.
   */
  private markFinished() {
    this.generation.bump();
    this.gameFinished = true;
    this.clearDeadline();
    this.gameActions.closeDayVote();
  }

  async finishSegment() {
    await this.advanceSegment();
  }

  // playEndAudio: false lets callers that already narrated the segment's
  // outcome (day-vote resolution, tie) move on without the generic end audio
  //
  // One transition per segment: a second call while this segment is
  // already ending (a wolf's repeated agreeing vote, a deadline racing the
  // last action) is a no-op
  async advanceSegment({
    playEndAudio = true,
  }: { playEndAudio?: boolean } = {}) {
    if (this.endingRun === this.segmentRun) {
      return;
    }

    this.endingRun = this.segmentRun;
    this.clearDeadline();
    const segment = this.segments[this.currentSegment];

    if (
      playEndAudio &&
      !(await this.narrate(
        this.audioManager.playSegmentAudio(segment.type, false)
      ))
    ) {
      return;
    }

    this.markFirstNightSegment(segment);

    this.segmentRun++;
    this.currentSegment++;
    this.findValidSegment();

    this.playSegment();
  }
}
