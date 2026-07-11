import type { Role } from '@repo/types';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';
import { RecordingIO } from '@/simulation/recording-io';

export type SimWinner = 'villagers' | 'werewolves' | null;

export type LoversSpec =
  | 'random' // two random distinct players
  | 'random-with-hunter' // force the hunter (if any) to be one of the lovers
  | [string, string] // explicit [sidA, sidB]
  | null; // no lovers

export type WitchStrategy = 'always' | 'never' | 'random';

export interface SimOptions {
  playerCount?: number;
  playerNames?: string[];
  /** Force this player NAME to be the HUNTER (sets DEV_FORCE_HUNTER). */
  forceHunterName?: string | null;
  lovers?: LoversSpec;
  witchHealStrategy?: WitchStrategy;
  witchPoisonStrategy?: WitchStrategy;
  /** Max night rounds before giving up (safety cap). */
  maxRounds?: number;
  /** Drain microtasks + fire 0ms timers between phases. */
  flush?: () => Promise<void>;
  /** Seeded RNG for reproducible runs (default Math.random). */
  rng?: () => number;
}

/**
 * `AudioManager` subclass that records every file the real manager would
 * have played, in order, and never touches the disk or `sound-play`. Because
 * every `audio-manager` method calls `this.playAudio` / `await this.playAudio`,
 * overriding `playAudio` captures the full intended audio sequence — including
 * files with no on-disk asset — exactly as the live code would emit it.
 */
export class RecordingAudioManager extends AudioManager {
  readonly audioLog: string[] = [];

  override async playAudio(file: string) {
    this.audioLog.push(file);
  }
}

/**
 * Drives a full Werewolf game to completion with random role attribution and
 * mocked audio, recording the ordered audio / emit / death logs so they can
 * be validated. It uses the REAL `Game` / `SegmentsManager` / resolution
 * programs — only the transport (socket + audio) is recorded — so the audio
 * sequence is authentic.
 *
 * The day vote uses a light "self-correcting village" heuristic: when the
 * werewolves are at risk of overrunning the village (≥2 werewolves and the
 * villagers are outnumbered-or-nearly), the village votes a werewolf out.
 * This keeps random games terminating under the production `checkIfWinner`
 * (which only ends the game at 0 werewolves or a 1-v-1), without biasing the
 * lover/hunter death-audio sequences that this harness exists to validate.
 */
export class GameSimulator {
  readonly io = new RecordingIO();
  readonly deathManager = new DeathManager();
  readonly game: Game;
  readonly audioManager: RecordingAudioManager;
  readonly specialScenarios: SpecialScenarios;
  readonly segmentsManager: SegmentsManager;
  readonly eventsActions: EventsActions;

  /** Ordered audio files that would have played. */
  audioLog: string[] = [];
  /** Ordered death socket ids (from `lobby:player-died`). */
  deathLog: string[] = [];
  winner: SimWinner = null;
  rounds = 0;
  error: unknown = null;

  private readonly opts: Required<
    Omit<SimOptions, 'forceHunterName' | 'lovers'>
  > & {
    forceHunterName: string | null;
    lovers: LoversSpec;
  };
  private readonly flush: () => Promise<void>;
  private readonly rng: () => number;
  private readonly players: Player[] = [];
  private savedDelayEnv: string | undefined;
  private savedMathRandom: () => number = Math.random;
  /** Captured dawn promise (set by the `run()` wrapper each night). */
  private pendingDawnPromise: Promise<void> | null = null;

  constructor(options: SimOptions = {}) {
    const socketIo = this.io as unknown as SocketType;
    this.game = new Game(socketIo, this.deathManager);
    this.audioManager = new RecordingAudioManager(this.deathManager);
    this.specialScenarios = new SpecialScenarios(this.game, this.audioManager);
    this.segmentsManager = new SegmentsManager(
      this.game,
      socketIo,
      this.audioManager,
      this.specialScenarios
    );
    this.eventsActions = new EventsActions(
      this.game,
      this.segmentsManager,
      socketIo
    );

    // Wrap `nightDawnResolution.run` so the simulator can await the dawn
    // resolution the segment loop already started (playSegment(DAY) fires it
    // fire-and-forget). Without this the simulator would have no handle to
    // feed hunter picks into, and re-calling run() would double the deaths.
    const dawnRes = this.segmentsManager.nightDawnResolution;
    const origRun = dawnRes.run.bind(dawnRes);
    dawnRes.run = () => {
      const promise = origRun();
      this.pendingDawnPromise = promise;
      return promise;
    };

    this.opts = {
      playerCount: options.playerCount ?? 6,
      playerNames: options.playerNames ?? [],
      forceHunterName: options.forceHunterName ?? null,
      lovers: options.lovers ?? 'random',
      witchHealStrategy: options.witchHealStrategy ?? 'random',
      witchPoisonStrategy: options.witchPoisonStrategy ?? 'random',
      maxRounds: options.maxRounds ?? 30,
      flush: options.flush ?? (() => new Promise((r) => setTimeout(r, 0))),
      rng: options.rng ?? Math.random,
    };
    this.flush = this.opts.flush;
    this.rng = this.opts.rng;
  }

  // ---- public results -------------------------------------------------

  get audio() {
    return this.audioLog;
  }

  roleOf(sid: string): Role | undefined {
    const player = this.game.getPlayerBySocketId(sid);
    if (!player) {
      return undefined;
    }
    try {
      return player.getRole();
    } catch {
      return undefined;
    }
  }

  isLover(sid: string): boolean {
    const player = this.game.getPlayerBySocketId(sid);
    return player ? this.game.isPlayerLover(player) : false;
  }

  aliveSids(): string[] {
    return this.game.getAlivePlayers().map((p) => p.getSocketId());
  }

  // ---- lifecycle ------------------------------------------------------

  async run() {
    try {
      this.setup();
      await this.drive();
      this.winner = this.game.checkIfWinner();
    } catch (error) {
      this.error = error;
      this.winner = this.game.checkIfWinner();
    } finally {
      this.dispose();
    }
    return this;
  }

  private setup() {
    // Fast day-vote turn-around so many games run "real quick". The
    // day:voting-phase-start emit carries no audio, so 0ms only affects the
    // (ignored) UI prompt timing, not the audio sequence.
    this.savedDelayEnv = process.env.DAY_VOTE_DELAY_MS;
    process.env.DAY_VOTE_DELAY_MS = '0';

    // Seed Math.random too so Game.shuffleArray (role assignment) is
    // reproducible, not just the simulator's own decisions.
    this.savedMathRandom = Math.random;
    Math.random = this.rng;

    const count = this.opts.playerCount;
    for (let i = 0; i < count; i++) {
      const name = this.opts.playerNames[i] ?? `Player${i + 1}`;
      const sid = `sim-${i + 1}`;
      const player = this.game.addPlayer(name, sid);
      this.players.push(player);
    }

    // assignRoles() shuffles the role list randomly and calls
    // setPlayerTeams + setSpecialRolePlayer internally. HUNTER is commented
    // out of initRolesList, so no hunter is assigned here.
    this.game.assignRoles();
    this.game.alertPlayersOfRoles();

    // Force a hunter by converting a villager (NOT via DEV_FORCE_HUNTER —
    // that env var can splice CUPID out of the role list when HUNTER isn't
    // in it, leaving the game with no cupid and crashing cupidAction). A
    // villager→hunter conversion keeps CUPID/WITCH/werewolves intact; the
    // player stays in teamVillagers (hunter is villager-team), so no
    // re-teaming (addTeamVillager doesn't dedup).
    this.ensureHunter();

    this.chooseLovers();
  }

  private dispose() {
    if (this.savedDelayEnv === undefined) {
      delete process.env.DAY_VOTE_DELAY_MS;
    } else {
      process.env.DAY_VOTE_DELAY_MS = this.savedDelayEnv;
    }
    Math.random = this.savedMathRandom;
  }

  /**
   * Convert a villager to the hunter so hunter-pick audio paths run. Prefer
   * the named player when they are a villager; otherwise any villager. Does
   * NOT re-call setPlayerTeams (the player is already in teamVillagers and
   * addTeamVillager doesn't dedup).
   */
  private ensureHunter() {
    if (!this.opts.forceHunterName) {
      return;
    }
    const villagers = this.players.filter((p) => p.getRole() === 'VILLAGER');
    const preferred = villagers.find(
      (p) => p.getName() === this.opts.forceHunterName
    );
    const target = preferred ?? this.pickRandom(villagers);
    if (!target) {
      return; // no villager to convert (tiny player counts)
    }
    target.setRole('HUNTER');
    this.game.setSpecialRolePlayer(target);
  }

  private chooseLovers() {
    const spec = this.opts.lovers;
    if (spec === null) {
      return;
    }
    if (Array.isArray(spec)) {
      this.game.setLovers(spec);
      return;
    }
    const pool = [...this.players];
    let loverA: Player | undefined;
    let loverB: Player | undefined;
    if (spec === 'random-with-hunter') {
      const hunter = this.game.getSpecialRolePlayer('HUNTER');
      if (hunter) {
        loverA = hunter;
        loverB = this.pickRandom(pool.filter((p) => p !== hunter));
      }
    }
    if (!loverA || !loverB) {
      loverA = this.pickRandom(pool);
      loverB = this.pickRandom(pool.filter((p) => p !== loverA));
    }
    if (loverA && loverB) {
      this.game.setLovers([loverA.getSocketId(), loverB.getSocketId()]);
    }
  }

  // ---- the game loop --------------------------------------------------

  private async drive() {
    // Night 1: CUPID plays (startGame) then advance past it; LOVERS is
    // marked skip after night 1 so the loop never lands on it. Lovers are
    // already chosen, so finishSegment advances straight to WEREWOLF.
    this.segmentsManager.startGame();
    await this.flush();
    await this.segmentsManager.finishSegment();
    await this.flush();

    while (
      this.game.checkIfWinner() === null &&
      this.rounds < this.opts.maxRounds
    ) {
      this.rounds++;
      await this.playWerewolfPhase();
      if (this.game.checkIfWinner() !== null) {
        break;
      }
      await this.playWitchPhase('WITCH-HEAL');
      await this.playWitchPhase('WITCH-POISON');
      await this.playDayPhase();
      if (this.game.checkIfWinner() !== null) {
        break;
      }
    }
  }

  private async playWerewolfPhase() {
    const aliveWerewolves = this.game
      .getWerewolfList()
      .filter((w) => w.isAlive);
    if (aliveWerewolves.length === 0) {
      return; // no werewolves → villagers win (caught by the drive loop)
    }
    const target = this.pickWerewolfTarget();
    if (!target) {
      // No alive non-werewolf left to kill — a winner should already be set.
      return;
    }
    for (const werewolf of aliveWerewolves) {
      // handleWerewolfVote calls finishSegment() itself once all werewolves
      // agree, so the last vote advances the segment to the witch phase.
      this.eventsActions.handleWerewolfVote(werewolf.getSocketId(), target);
      await this.flush();
    }
  }

  private pickWerewolfTarget(): string | undefined {
    const candidates = this.game
      .getAlivePlayers()
      .filter((p) => p.getRole() !== 'WEREWOLF');
    return this.pickRandom(candidates)?.getSocketId();
  }

  private async playWitchPhase(segment: 'WITCH-HEAL' | 'WITCH-POISON') {
    if (this.segmentsManager.getCurrentSegmentType() !== segment) {
      return; // segment was skipped
    }
    const witch = this.game.getSpecialRolePlayer('WITCH');
    const witchAlive = witch?.isAlive ?? false;
    if (segment === 'WITCH-HEAL') {
      if (
        witchAlive &&
        this.game.canWitchHeal() &&
        this.strategyDecide('witchHealStrategy')
      ) {
        this.game.healWerewolfVictim();
      }
    } else {
      if (
        witchAlive &&
        this.game.canWitchPoison() &&
        this.strategyDecide('witchPoisonStrategy')
      ) {
        const target = this.pickWitchPoisonTarget();
        if (target) {
          this.game.witchKill(target);
        }
      }
    }
    // The witch prompt was emitted to the witch's socket during the segment
    // action; the simulator decides proactively (heal / poison / skip) and
    // advances, mirroring the server handlers' effect without waiting on a
    // client response (which also sidesteps the dead-witch stall quirk).
    await this.segmentsManager.finishSegment();
    await this.flush();
  }

  private pickWitchPoisonTarget(): string | undefined {
    const candidates = this.game
      .getAlivePlayers()
      .filter((p) => p.getRole() !== 'WITCH');
    return this.pickRandom(candidates)?.getSocketId();
  }

  private async playDayPhase() {
    // playSegment(DAY) — fired by the segment loop after the witch phase —
    // already started the dawn resolution in the background; the `run()`
    // wrapper captured its promise. Await that handle and feed it hunter
    // picks instead of starting a second resolution (which would double the
    // deaths + audio).
    let dawn = this.pendingDawnPromise;
    let waits = 0;
    while (!dawn && waits++ < 20) {
      await this.flush();
      dawn = this.pendingDawnPromise;
    }
    this.pendingDawnPromise = null;
    if (!dawn) {
      return; // segment never reached DAY
    }
    await this.resolveWithHunterPick(dawn);

    if (this.game.checkIfWinner() !== null) {
      return;
    }

    // Day vote: every alive player votes a single target so the village
    // reaches a clean elimination (the tie path is out of scope — covered by
    // day-vote-scenarios.test.ts / plan 027). The target is a werewolf when
    // the village is at risk of being overrun, else a random alive player.
    const alive = this.game.getAlivePlayers();
    const target = this.pickDayVoteTarget(alive);
    if (!target) {
      return;
    }
    let lastVote: Promise<unknown> = Promise.resolve();
    for (const voter of alive) {
      const result = this.eventsActions.handleDayVote(
        voter.getSocketId(),
        target
      );
      // The vote that makes hasAllPlayersVoted() true triggers the day-vote
      // resolution (an async program); that's the promise to feed picks into.
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        lastVote = result as Promise<unknown>;
      }
    }
    await this.resolveWithHunterPick(lastVote);
  }

  private pickDayVoteTarget(alive: Player[]): string | undefined {
    // Fully random unanimous vote — the village doesn't meta-game toward
    // werewolves. The production `checkIfWinner` (which now declares a
    // werewolf win at 0 villagers) keeps every game terminating, so no
    // self-correcting heuristic is needed. The tie path is out of scope
    // (covered by day-vote-scenarios.test.ts / plan 027).
    return this.pickRandom(alive)?.getSocketId();
  }

  /**
   * Let a resolution program (dawn or day-vote) run to completion, feeding in
   * a random hunter pick whenever it parks on a `hunter:pick-required`
   * Deferred. Handles the recursive consequences chain (a revenge target
   * that is itself a hunter / a lover whose partner is a hunter).
   */
  private async resolveWithHunterPick(promise: Promise<unknown>) {
    let settled = false;
    void promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      }
    );
    let scanned = 0;
    let iterations = 0;
    const maxIterations = 500;
    while (!settled && iterations++ < maxIterations) {
      await this.flush();
      const pending = this.io.eventsOfSince('hunter:pick-required', scanned);
      for (const record of pending) {
        scanned = this.io.emits.indexOf(record) + 1;
        const target = this.pickHunterTarget();
        if (target) {
          this.eventsActions.submitHunterPick(target);
        }
      }
    }
    await promise;
    await this.flush();
    // Capture deaths in order (lobby:player-died is emitted by Player.kill).
    for (const record of this.io.eventsOf('lobby:player-died')) {
      const sid = record.args[0];
      if (typeof sid === 'string' && !this.deathLog.includes(sid)) {
        this.deathLog.push(sid);
      }
    }
    this.audioLog = this.audioManager.audioLog;
  }

  private pickHunterTarget(): string | undefined {
    const hunterSid = this.game.getSpecialRolePlayer('HUNTER')?.getSocketId();
    const candidates = this.game
      .getAlivePlayers()
      .filter((p) => p.getSocketId() !== hunterSid);
    return this.pickRandom(candidates)?.getSocketId();
  }

  // ---- helpers --------------------------------------------------------

  private strategyDecide(opt: 'witchHealStrategy' | 'witchPoisonStrategy') {
    const strategy = this.opts[opt];
    if (strategy === 'always') {
      return true;
    }
    if (strategy === 'never') {
      return false;
    }
    return this.rng() < 0.5;
  }

  private pickRandom<T>(items: T[]): T | undefined {
    if (items.length === 0) {
      return undefined;
    }
    return items[Math.floor(this.rng() * items.length)];
  }
}
