import type { GamePhase, SegmentType } from '@repo/types';
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
const SEGMENT_TIMEOUTS = {
  CUPID: { defaultMs: 120_000, envVar: 'CUPID_TIMEOUT_MS' },
  LOVERS: { defaultMs: 60_000, envVar: 'LOVERS_TIMEOUT_MS' },
  SEER: { defaultMs: 60_000, envVar: 'SEER_TIMEOUT_MS' },
  WEREWOLF: { defaultMs: 120_000, envVar: 'WEREWOLF_TIMEOUT_MS' },
  'WITCH-HEAL': { defaultMs: 60_000, envVar: 'WITCH_HEAL_TIMEOUT_MS' },
  'WITCH-POISON': { defaultMs: 60_000, envVar: 'WITCH_POISON_TIMEOUT_MS' },
  // A family argues for a while before voting — leave them room
  DAY: { defaultMs: 600_000, envVar: 'DAY_VOTE_TIMEOUT_MS' },
  HUNTER: { defaultMs: 60_000, envVar: 'HUNTER_TIMEOUT_MS' },
} satisfies Record<SegmentType, { defaultMs: number; envVar: string }>;

export function resolveSegmentTimeoutMs(segmentType: SegmentType): number {
  const config = SEGMENT_TIMEOUTS[segmentType];

  const rawValue = process.env[config.envVar] ?? process.env.SEGMENT_TIMEOUT_MS;

  if (rawValue === undefined || rawValue === '') {
    return config.defaultMs;
  }

  return Number(rawValue);
}

/**
 * The order segments play in, one night-and-day cycle after another.
 * A segment with nothing to do this time round is passed over (see
 * `shouldRun`). The hunter's revenge pick is not a segment of its own:
 * it runs inside the dawn and day-vote resolutions.
 */
export const SEGMENT_ORDER = [
  'CUPID',
  'LOVERS',
  'SEER',
  'WEREWOLF',
  'WITCH-HEAL',
  'WITCH-POISON',
  'DAY',
] as const satisfies readonly SegmentType[];

type CycleSegment = (typeof SEGMENT_ORDER)[number];

export class SegmentsManager {
  io: Broadcaster;
  game: Game;
  gameActions: GameActions;
  nightDawnResolution: NightDawnResolution;
  audioManager: AudioManager;
  /** Index into SEGMENT_ORDER. */
  currentSegment: number;
  specialScenarios: SpecialScenarios;
  private gameStarted = false;
  private gameFinished = false;
  /** Cleared once the cycle wraps: Cupid and Lovers only run on night one. */
  private isFirstNight = true;
  private readonly actions = {
    CUPID: () => this.gameActions.cupidAction(),
    LOVERS: () => this.gameActions.loversAction(),
    SEER: () => this.gameActions.seerAction(),
    WEREWOLF: () => this.gameActions.werewolfAction(),
    'WITCH-HEAL': () => this.gameActions.witchHealAction(),
    'WITCH-POISON': () => this.gameActions.witchPoisonAction(),
    DAY: () => this.gameActions.dayAction(),
  } satisfies Record<CycleSegment, () => void>;
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
  }

  getGameActions() {
    return this.gameActions;
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

  getCurrentSegmentType(): GamePhase {
    if (this.gameFinished) {
      return 'FINISHED';
    }

    if (!this.gameStarted) {
      return 'LOBBY';
    }

    return SEGMENT_ORDER[this.currentSegment];
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
    this.isFirstNight = true;
  }

  isHunterInDeathQueue() {
    return this.game.hunterIsInDeathQueue();
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
    const segmentType = SEGMENT_ORDER[this.currentSegment];

    // Passed over silently: clients only hear about segments that run
    if (!this.shouldRun(segmentType)) {
      await this.advanceSegment({ playEndAudio: false });

      return;
    }

    console.log(`[SEGMENT] Playing segment: ${segmentType}`);
    this.io.emit('game:phase-changed', this.getCurrentSegmentType());

    if (segmentType === 'DAY') {
      // Dawn (night-death reveal + day start) runs as one resolution
      // program; it pauses internally when the hunter must pick
      this.scheduleDeadline(segmentType);
      this.nightDawnResolution.run().catch((error) => {
        console.error('night dawn resolution failed:', error);
      });

      return;
    }

    const narrated = await this.narrate(
      this.audioManager.playSegmentAudio(segmentType, true)
    );

    // Reset, finished, or already moved past (admin:next-segment) while
    // the intro played
    if (!narrated || run !== this.segmentRun) {
      return;
    }

    this.actions[segmentType]();
    this.scheduleDeadline(segmentType);
  }

  /** Whether `segmentType` has anything to do in the current game state. */
  private shouldRun(segmentType: CycleSegment) {
    if (segmentType === 'CUPID' || segmentType === 'LOVERS') {
      return this.isFirstNight;
    }

    if (segmentType === 'SEER') {
      return this.game.getSpecialRolePlayer('SEER')?.isAlive ?? false;
    }

    const witchAlive =
      this.game.getSpecialRolePlayer('WITCH')?.isAlive ?? false;

    if (segmentType === 'WITCH-HEAL') {
      return (
        witchAlive &&
        this.game.canWitchHeal() &&
        Boolean(this.game.getWerewolfTarget())
      );
    }

    if (segmentType === 'WITCH-POISON') {
      return witchAlive && this.game.canWitchPoison();
    }

    return true;
  }

  private scheduleDeadline(segmentType: SegmentType) {
    const timeoutMs = resolveSegmentTimeoutMs(segmentType);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return;
    }

    this.clearDeadline();
    this.deadlineEndsAt = Date.now() + timeoutMs;

    if (segmentType !== 'DAY') {
      // DAY announces its own countdowns: first the discussion window,
      // then the vote's remaining time
      this.io.emit('game:countdown', segmentType, timeoutMs);
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

  private async handleSegmentTimeout(segmentType: SegmentType) {
    this.io.emit('game:phase-timed-out', segmentType);

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
    const segmentType = SEGMENT_ORDER[this.currentSegment];

    if (
      playEndAudio &&
      !(await this.narrate(
        this.audioManager.playSegmentAudio(segmentType, false)
      ))
    ) {
      return;
    }

    this.segmentRun++;
    this.currentSegment = (this.currentSegment + 1) % SEGMENT_ORDER.length;

    if (this.currentSegment === 0) {
      this.isFirstNight = false;
    }

    this.playSegment();
  }
}
