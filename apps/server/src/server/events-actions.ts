import type { Game } from '@/core/game';
import type { Player } from '@/core/player';
import type { SegmentsManager } from '@/segments/segments-manager';
import { DayVoteResolution } from '@/server/day-vote-resolution';
import type { SocketType } from '@/server/sockets';

export class EventsActions {
  private readonly game: Game;
  private readonly segmentsManager: SegmentsManager;
  private readonly io: SocketType;
  private readonly dayVoteResolution: DayVoteResolution;

  constructor(game: Game, segmentsManager: SegmentsManager, io: SocketType) {
    this.game = game;
    this.segmentsManager = segmentsManager;
    this.io = io;
    this.dayVoteResolution = new DayVoteResolution(game, segmentsManager, io);
  }

  /**
   * Routes a hunter pick to whichever resolution is paused waiting for
   * it. Returns false when neither is waiting.
   */
  submitHunterPick(targetSid: string) {
    return (
      this.dayVoteResolution.submitHunterPick(targetSid) ||
      this.segmentsManager.nightDawnResolution.submitHunterPick(targetSid)
    );
  }

  /** Is any resolution currently paused waiting on a hunter pick? */
  hasPendingHunterPick() {
    return (
      this.dayVoteResolution.hasPendingPick() ||
      this.segmentsManager.nightDawnResolution.hasPendingPick()
    );
  }

  /** Direct entry into the elimination chain, used by mock scenarios. */
  resolveDayVote(player: Player) {
    return this.dayVoteResolution.run(player);
  }

  handleWerewolfVote(werewolfSid: string, targetSid: string) {
    this.game.handleWerewolfVote(werewolfSid, targetSid);
    this.tryCompleteWerewolfVote();
  }

  /**
   * Finish the werewolf phase when every required (living, connected)
   * werewolf has voted for the same target. Also called when a werewolf
   * disconnects or dies, since that can be the event that completes the
   * vote. Returns whether the phase completed.
   */
  tryCompleteWerewolfVote() {
    if (!this.game.hasAllWerewolvesAgreed()) {
      return false;
    }

    // No votes at all (e.g. every wolf is gone): leave it to the segment
    // deadline rather than resolving a night with no victim
    if (!this.game.getWerewolfTarget()) {
      return false;
    }

    this.game.handleAllWerewolvesAgree();
    this.segmentsManager.finishSegment();
    return true;
  }

  async handleDayVote(voterSid: string, targetPlayer: string) {
    const voter = this.game.getPlayerBySocketId(voterSid);
    if (!voter || !voter.isAlive) {
      console.warn(`day:player-voted rejected from ${voterSid} (voter not alive)`);
      return;
    }

    const target = this.game.getPlayerBySocketId(targetPlayer);
    if (!target || !target.isAlive) {
      console.warn(
        `day:player-voted rejected: target ${targetPlayer} not alive or not found`
      );
      return;
    }

    this.game.handleDayVote(voterSid, targetPlayer);
    await this.tryCompleteDayVote();
  }

  /**
   * Resolve the day vote when every required (living, connected) player
   * has voted. Also called when a player disconnects, since that can be
   * the event that completes the vote.
   */
  async tryCompleteDayVote() {
    if (!(this.game.hasAllPlayersVoted() && this.game.hasAnyDayVote())) {
      return;
    }

    const result = this.game.getDayVoteResult();

    if (result.kind === 'tie') {
      console.log(
        `☀ Day vote tie between: ${result.tiedPlayerNames.join(', ')} — nobody dies`
      );
      this.game.clearDayVotes();
      this.io.emit('day:vote-tie', result.tiedPlayerNames);
      await this.segmentsManager.advanceSegment({ playEndAudio: false });
      return;
    }

    await this.dayVoteResolution.run(result.player);
  }
}
