import { Deferred, Duration, Effect } from 'effect';
import type { Game } from '@/core/game';
import { StaleGame } from '@/segments/game-generation';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { Broadcaster } from '@/server/broadcaster';
import { awaitInGame, narration, runResolution } from '@/server/stale-game';

/**
 * Resolves the night/dawn death flow as one linear Effect program:
 * the dawn reveal of queued night deaths, a dead lover's partner
 * dying of grief, and a dead hunter's revenge shot — which parks on
 * a Deferred until the socket handler feeds the pick in through
 * submitHunterPick.
 *
 * Unlike the day-vote flow, deaths here stay queued until
 * GameActions.dayAction() → Game.processPendingDeaths() runs them;
 * the resolution only queues, plays audio, pauses for the pick, and
 * then calls dayAction().
 */
export class NightDawnResolution {
  private pendingHunterPick: Deferred.Deferred<string, StaleGame> | null = null;

  constructor(
    private readonly game: Game,
    private readonly segmentsManager: SegmentsManager,
    private readonly io: Broadcaster
  ) {
    // A finished or reset game drops its pending pick (and its timeout)
    segmentsManager.onGameEnded(() => this.cancelPendingPick());
  }

  /**
   * Kick off the dawn resolution as a background promise. It stops at
   * the first await that outlives its game (finished or reset).
   */
  run(): Promise<void> {
    return runResolution(
      this.resolveDawn(this.segmentsManager.getGeneration())
    );
  }

  /**
   * Called by the hunter socket handler. Returns false when no night
   * resolution is waiting on a pick, so the caller can log a warning.
   */
  submitHunterPick(targetSid: string) {
    const pick = this.pendingHunterPick;

    if (!pick) {
      return false;
    }

    this.pendingHunterPick = null;
    Deferred.unsafeDone(pick, Effect.succeed(targetSid));

    return true;
  }

  hasPendingPick() {
    return this.pendingHunterPick !== null;
  }

  private cancelPendingPick() {
    const pick = this.pendingHunterPick;

    if (pick) {
      this.pendingHunterPick = null;
      Deferred.unsafeDone(pick, Effect.fail(new StaleGame()));
    }
  }

  private resolveDawn(generation: number): Effect.Effect<void, StaleGame> {
    return Effect.gen(this, function* () {
      const audioManager = this.segmentsManager.audioManager;
      const specialScenarios = this.segmentsManager.specialScenarios;

      // Branch A — hunter is in the death queue
      if (this.game.hunterIsInDeathQueue()) {
        const hunter = this.game.getSpecialRolePlayer('HUNTER');

        if (!hunter) {
          throw new Error(
            'tried to play hunter segment but hunter player not found'
          );
        }

        if (this.game.isPlayerLover(hunter)) {
          const partner = this.game.getPartner(hunter);

          if (!partner) {
            throw new Error('lover could not be found');
          }

          this.game.addPartnerSuicide(
            hunter.getSocketId(),
            partner.getSocketId()
          );
          yield* this.narrate(() => specialScenarios.hunterIsLover());
        } else {
          yield* this.narrate(() => audioManager.playHunterAudio());

          if (this.game.isOneOfLoversInDeathQueue()) {
            yield* this.narrate(() => audioManager.playLoverAudio());
          }
        }

        this.game.updateHunterPlayerList();
        yield* this.hunterPickAndContinue(generation);

        return;
      }

      // Branch B/C — a lover is in the death queue
      if (this.game.isOneOfLoversInDeathQueue()) {
        if (this.game.isPartnerHunter()) {
          // Branch B — surviving partner is the hunter
          yield* this.narrate(() => specialScenarios.partnerIsHunter());
          this.game.updateHunterPlayerList();
          yield* this.hunterPickAndContinue(generation);

          return;
        }

        // Branch C — lover died, partner is not the hunter
        yield* this.narrate(() => audioManager.playLoverAudio());

        if (!this.segmentsManager.isGameOver()) {
          yield* Effect.promise(() =>
            this.segmentsManager.getGameActions().dayAction()
          );
        }

        return;
      }

      // Branch D — no special deaths
      yield* this.narrate(() => audioManager.playSegmentAudio('DAY', true));
      yield* Effect.promise(() =>
        this.segmentsManager.getGameActions().dayAction()
      );
    });
  }

  /**
   * Steps shared by Branches A and B: pause for the hunter's pick,
   * run post-pick consequences, then continue to the day action.
   */
  private hunterPickAndContinue(
    generation: number
  ): Effect.Effect<void, StaleGame> {
    return Effect.gen(this, function* () {
      const audioManager = this.segmentsManager.audioManager;

      // Pause until the socket handler feeds in the pick
      const targetSid = yield* awaitInGame(
        this.segmentsManager,
        generation,
        this.awaitHunterPick()
      );

      if (targetSid === null) {
        console.warn('Night-dawn hunter pick timed out — skipping revenge kill');

        if (this.segmentsManager.isGameOver()) {
          return;
        }

        yield* this.narrate(() => audioManager.playDayVoteAudio());
        yield* Effect.promise(() =>
          this.segmentsManager.getGameActions().dayAction()
        );

        return;
      }

      // Post-pick consequences
      this.game.killHunterRevenge(targetSid);

      if (this.game.isHunterVictimInLove(targetSid)) {
        const lover = this.game.getPlayerBySocketId(targetSid);

        if (!lover) {
          throw new Error(`Target ${targetSid} not found`);
        }

        const partner = this.game.getPartner(lover);

        if (!partner) {
          throw new Error(`Partner not found for ${targetSid}`);
        }

        this.game.addPendingDeath(partner.getSocketId(), 'PARTNER_SUICIDE');
        yield* this.narrate(() => audioManager.playHunterKilledLover());
      }

      this.game.isHunterInLove();

      if (this.segmentsManager.isGameOver()) {
        return;
      }

      yield* this.narrate(() => audioManager.playDayVoteAudio());
      yield* Effect.promise(() =>
        this.segmentsManager.getGameActions().dayAction()
      );
    });
  }

  /** Awaits narration; it fails with StaleGame if the game ends mid-clip. */
  private narrate(play: () => Promise<void>) {
    return narration(play);
  }

  private awaitHunterPick(): Effect.Effect<string | null, StaleGame> {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string, StaleGame>();
      this.pendingHunterPick = pick;
      const hunter = this.game.getSpecialRolePlayer('HUNTER');

      if (hunter) {
        this.io.to(hunter.getSocketId()).emit('hunter:pick-required');
      }

      const result = yield* Effect.timeoutOption(
        Deferred.await(pick),
        Duration.seconds(60)
      );

      // A newer pick may be pending by now: only clear our own
      if (this.pendingHunterPick === pick) {
        this.pendingHunterPick = null;
      }

      if (result._tag === 'None') {
        return null;
      }

      return result.value;
    });
  }
}
