import { Deferred, Effect } from 'effect';
import type { Game } from '@/core/game';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

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
  private pendingHunterPick: Deferred.Deferred<string> | null = null;

  constructor(
    private readonly game: Game,
    private readonly segmentsManager: SegmentsManager,
    private readonly io: SocketType
  ) {}

  /** Kick off the dawn resolution as a background promise. */
  run(): Promise<void> {
    return Effect.runPromise(this.resolveDawn());
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

  private resolveDawn(): Effect.Effect<void> {
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
          yield* Effect.promise(() => specialScenarios.hunterIsLover());
        } else {
          yield* Effect.promise(() => audioManager.playHunterAudio());
        }

        this.game.updateHunterPlayerList();
        yield* this.hunterPickAndContinue();
        return;
      }

      // Branch B/C — a lover is in the death queue
      if (this.game.isOneOfLoversInDeathQueue()) {
        if (this.game.isPartnerHunter()) {
          // Branch B — surviving partner is the hunter
          yield* Effect.promise(() => specialScenarios.partnerIsHunter());
          this.game.updateHunterPlayerList();
          yield* this.hunterPickAndContinue();
          return;
        }

        // Branch C — lover died, partner is not the hunter
        yield* Effect.promise(() => audioManager.playLoverAudio());
        if (!this.segmentsManager.isGameOver()) {
          yield* Effect.promise(() =>
            this.segmentsManager.getGameActions().dayAction()
          );
        }
        return;
      }

      // Branch D — no special deaths
      yield* Effect.promise(() => audioManager.playSegmentAudio('DAY', true));
      yield* Effect.promise(() =>
        this.segmentsManager.getGameActions().dayAction()
      );
    });
  }

  /**
   * Steps shared by Branches A and B: pause for the hunter's pick,
   * run post-pick consequences, then continue to the day action.
   */
  private hunterPickAndContinue(): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const audioManager = this.segmentsManager.audioManager;

      // Pause until the socket handler feeds in the pick
      const targetSid = yield* this.awaitHunterPick();

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
        yield* Effect.promise(() => audioManager.playHunterKilledLover());
      }

      this.game.isHunterInLove();

      if (this.segmentsManager.isGameOver()) {
        return;
      }

      yield* Effect.promise(() => audioManager.playDayVoteAudio());
      yield* Effect.promise(() =>
        this.segmentsManager.getGameActions().dayAction()
      );
    });
  }

  private awaitHunterPick() {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string>();
      this.pendingHunterPick = pick;
      this.io.emit('hunter:pick-required');
      return yield* Deferred.await(pick);
    });
  }
}