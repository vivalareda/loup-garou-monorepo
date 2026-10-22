import type { GamePhase, Segment, SegmentType } from '@repo/types';
import { Cause, Effect, Fiber, FiberSet, Scope } from 'effect';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
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
  /**
   * The fibers of the segment being played: its intro, action and
   * deadline, the transition out of it, and whatever it runs meanwhile
   * (the dawn, a day vote, the lovers alerts). Ending the segment,
   * finishing or resetting the game interrupts them all, so no narration,
   * timer or hunter pick of a past segment or game runs on. The set lives
   * as long as the manager, so the scope it is made in is never closed.
   */
  private readonly segmentFibers = Effect.runSync(
    Scope.provide(FiberSet.make<void>(), Scope.makeUnsafe())
  );
  /**
   * Set while `advanceSegment` plays the segment's end clip: one
   * transition per segment, so a second call meanwhile (a wolf's repeated
   * agreeing vote, a deadline racing the last action) is a no-op.
   */
  private ending = false;
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
    this.interruptSegment();
    this.ending = false;
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

  /**
   * Runs `effect` as part of the current segment: it is interrupted when
   * the segment ends or the game finishes or is reset. Resolves once it
   * completes or is interrupted, and rejects if it dies.
   */
  runInSegment(effect: Effect.Effect<void>): Promise<void> {
    const fiber = Effect.runSync(FiberSet.run(this.segmentFibers, effect));

    return Effect.runPromise(
      Fiber.join(fiber).pipe(
        Effect.catchCauseIf(Cause.hasInterruptsOnly, () => Effect.void)
      )
    );
  }

  /** Calls `callback` after `delayMs`, unless the segment ends first. */
  afterDelay(delayMs: number, callback: () => void) {
    void this.runInSegment(
      Effect.sleep(delayMs).pipe(Effect.andThen(Effect.sync(callback)))
    );
  }

  /** Stops everything the current segment runs, its deadline included. */
  private interruptSegment() {
    this.deadlineEndsAt = null;
    Effect.runFork(FiberSet.clear(this.segmentFibers));
  }

  async playSegment() {
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
      this.startDeadline(segment.type);
      this.nightDawnResolution.run().catch((error) => {
        console.error('night dawn resolution failed:', error);
      });

      return;
    }

    await this.runInSegment(
      Effect.gen({ self: this }, function* () {
        yield* this.audioManager.playSegmentAudio(segment.type, true);
        segment.action();
        this.startDeadline(segment.type);
      })
    );
  }

  private shouldAutoSkipSegment(segmentType: SegmentType) {
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

  /**
   * Times the segment out unless it ends first: the deadline is a sleep
   * among the segment's fibers, so ending the segment cancels it.
   */
  private startDeadline(segmentType: SegmentType) {
    const timeoutMs = resolveSegmentTimeoutMs(segmentType);

    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return;
    }

    this.deadlineEndsAt = Date.now() + timeoutMs;

    if (segmentType !== 'DAY') {
      // DAY announces its own countdowns: first the discussion window,
      // then the vote's remaining time
      this.io.emit('game:countdown', segmentType, timeoutMs);
    }

    void this.runInSegment(
      Effect.sleep(timeoutMs).pipe(
        Effect.andThen(
          Effect.sync(() => {
            console.warn(
              `[SEGMENT] ${segmentType} timed out; applying fallback`
            );
            this.handleSegmentTimeout(segmentType);
          })
        )
      )
    );
  }

  getRemainingDeadlineMs() {
    if (this.deadlineEndsAt === null) {
      return null;
    }

    return Math.max(0, this.deadlineEndsAt - Date.now());
  }

  private handleSegmentTimeout(segmentType: SegmentType) {
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

    void this.advanceSegment({ playEndAudio: false });
  }

  isGameOver() {
    const winner = this.game.checkIfWinner();

    if (winner === 'villagers') {
      Effect.runFork(this.audioManager.playVillagersWonAudio());
      this.game.alertWinnersAndLosers(winner);
      this.markFinished();

      return true;
    }

    if (winner === 'werewolves') {
      Effect.runFork(this.audioManager.playWerewolvesWonAudio());
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
    this.gameFinished = true;
    this.interruptSegment();
    this.gameActions.closeDayVote();
  }

  async finishSegment() {
    await this.advanceSegment();
  }

  // playEndAudio: false lets callers that already narrated the segment's
  // outcome (day-vote resolution, tie) move on without the generic end audio
  //
  // Ending the segment interrupts its fibers, the caller's own included
  // (a deadline, a day-vote resolution): nothing runs after this call.
  // The end clip runs as the segment's last fiber, so a reset or a game
  // end meanwhile drops the transition.
  async advanceSegment({
    playEndAudio = true,
  }: { playEndAudio?: boolean } = {}) {
    if (this.ending) {
      return;
    }

    this.ending = true;
    this.interruptSegment();
    const segment = this.segments[this.currentSegment];

    await this.runInSegment(
      Effect.gen({ self: this }, function* () {
        if (playEndAudio) {
          yield* this.audioManager.playSegmentAudio(segment.type, false);
        }

        this.ending = false;
        this.markFirstNightSegment(segment);
        this.currentSegment++;
        this.findValidSegment();

        this.playSegment();
      })
    );
  }
}
