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
   * Routes a hunter pick to a paused day-vote resolution if one is
   * waiting on it. Returns false when the pick belongs to the night flow.
   */
  submitHunterPick(targetSid: string) {
    return this.dayVoteResolution.submitHunterPick(targetSid);
  }

  /** Direct entry into the elimination chain, used by mock scenarios. */
  resolveDayVote(player: Player) {
    return this.dayVoteResolution.run(player);
  }

  /** Night flow: hunter died during the night, revealed at dawn. */
  async handleHunterPlayerPick(targetSid: string) {
    // Step 1: Kill the hunter's revenge target
    this.game.killHunterRevenge(targetSid);

    // Step 2: Check if the victim is a lover → trigger partner suicide
    if (this.game.isHunterVictimInLove(targetSid)) {
      console.log(`🎯💕 [HUNTER] Hunter killed a lover: ${targetSid}`);

      const lover = this.game.getPlayerBySocketId(targetSid);
      if (!lover) {
        throw new Error(`Target ${targetSid} not found`);
      }

      const partner = this.game.getPartner(lover);
      if (!partner) {
        throw new Error(`Partner not found for ${targetSid}`);
      }

      console.log(
        `🎯💕 [HUNTER] Partner ${partner.getSocketId()} will also die`
      );

      // Add partner to death queue
      this.game.addPendingDeath(partner.getSocketId(), 'PARTNER_SUICIDE');

      // Play special audio for hunter killing lover
      await this.segmentsManager.audioManager.playHunterKilledLover();
    }

    // Step 3: Check if the HUNTER had a lover → trigger partner suicide
    this.game.isHunterInLove();

    // Step 4: Continue to the day action
    this.segmentsManager.continueDayAction();
  }

  handleWerewolfVote(werewolfSid: string, targetSid: string) {
    this.game.handleWerewolfVote(werewolfSid, targetSid);
    if (this.game.hasAllWerewolvesAgreed()) {
      this.game.handleAllWerewolvesAgree();
      this.segmentsManager.finishSegment();
    }
  }

  async handleDayVote(voterSid: string, targetPlayer: string) {
    this.game.handleDayVote(voterSid, targetPlayer);

    if (!this.game.hasAllPlayersVoted()) {
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
