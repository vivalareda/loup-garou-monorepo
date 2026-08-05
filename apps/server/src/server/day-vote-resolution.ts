import { Deferred, Duration, Effect } from 'effect';
import type { Game } from '@/core/game';
import type { Player } from '@/core/player';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

/**
 * Resolves everything that follows a day-vote elimination as one linear
 * Effect program: the elimination itself, a lover dying of grief, a dead
 * hunter's revenge shot, and any chain of those.
 *
 * When the hunter needs to pick a revenge target the program parks on a
 * Deferred until the socket handler feeds the pick in through
 * submitHunterPick — the "are we mid day-vote?" context lives in the
 * program's position, not in flags spread across handlers.
 */
export class DayVoteResolution {
  private pendingHunterPick: Deferred.Deferred<string> | null = null;

  constructor(
    private readonly game: Game,
    private readonly segmentsManager: SegmentsManager,
    private readonly io: SocketType
  ) {}

  /**
   * Called by the hunter socket handler. Returns false when no day-vote
   * resolution is waiting on a pick, so the caller can fall back to the
   * night-death hunter flow.
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

  /** The village voted `votedPlayer` out — run the full death chain. */
  run(votedPlayer: Player) {
    return Effect.runPromise(this.resolveElimination(votedPlayer));
  }

  private resolveElimination(votedPlayer: Player): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      // "The village has spoken"
      yield* this.play('Day-vote/Vote-Death');

      this.killPlayer(votedPlayer);
      this.game.clearDayVotes();

      yield* this.resolveConsequences(votedPlayer);

      if (!this.segmentsManager.isGameOver()) {
        // The chain above already told the story of this day — skip the
        // generic day end audio
        yield* Effect.promise(() =>
          this.segmentsManager.advanceSegment({ playEndAudio: false })
        );
      }
    });
  }

  /**
   * A player just died during the day: their lover dies of grief, and if
   * any of the dead was the hunter he takes a revenge shot — recursively,
   * since the revenge target can itself be a lover.
   */
  private resolveConsequences(dead: Player): Effect.Effect<void> {
    return Effect.gen(this, function* () {
      const partner = this.game.isPlayerLover(dead)
        ? this.game.getPartner(dead)
        : undefined;

      if (partner?.isAlive) {
        yield* this.play('Day-vote/Lover');
        this.killPlayer(partner);
        yield* this.resolveConsequences(partner);
      }

      if (dead.getRole() === 'HUNTER') {
        yield* this.play('Day-vote/Hunter');

        const targetSid = yield* this.awaitHunterPick();

        if (targetSid === null) {
          return;
        }

        const target = this.game.getPlayerBySocketId(targetSid);

        if (target?.isAlive) {
          this.killPlayer(target);
          yield* this.resolveConsequences(target);
        }
      }
    });
  }

  private awaitHunterPick(): Effect.Effect<string | null> {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string>();
      this.pendingHunterPick = pick;
      const hunter = this.game.getSpecialRolePlayer('HUNTER');
      if (hunter) {
        this.io.to(hunter.getSocketId()).emit('hunter:pick-required');
      }

      const result = yield* Effect.timeoutOption(
        Deferred.await(pick),
        Duration.seconds(60)
      );
      this.pendingHunterPick = null;

      if (result._tag === 'None') {
        console.warn('Hunter pick timed out — skipping revenge kill');
        return null;
      }

      return result.value;
    });
  }

  private killPlayer(player: Player) {
    if (player.getRole() === 'WITCH') {
      this.segmentsManager.witchDied();
    }

    this.game.handlePlayerDeath(player);
  }

  private play(file: string) {
    return Effect.promise(() =>
      this.segmentsManager.audioManager.playAudio(file)
    );
  }
}
