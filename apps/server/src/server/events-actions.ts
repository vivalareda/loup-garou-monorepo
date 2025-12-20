import type { Game } from '@/core/game';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

export class EventsActions {
  private readonly game: Game;
  private readonly segmentsManager: SegmentsManager;
  private readonly io: SocketType;
  private hunterKilledDuringDayVote = false;

  constructor(game: Game, segmentsManager: SegmentsManager, io: SocketType) {
    this.game = game;
    this.segmentsManager = segmentsManager;
    this.io = io;
  }

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

    // Step 4: Continue based on context
    if (this.hunterKilledDuringDayVote) {
      console.log(
        '🎯 [HUNTER] Hunter was killed during day vote - playing day vote audio'
      );
      await this.segmentsManager.audioManager.playDayVoteAudio();
      this.hunterKilledDuringDayVote = false; // Reset flag
    } else {
      console.log(
        '🎯 [HUNTER] Hunter was killed during night - continuing to day action'
      );
      this.segmentsManager.continueDayAction();
    }
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

    // Check if voting is complete
    if (this.game.hasAllPlayersVoted()) {
      const player = this.game.getDayVoteTarget();

      if (this.game.hasPartner(player.getSocketId())) {
        if (player.getRole() === 'HUNTER') {
          this.segmentsManager.audioManager.playDayVoteHunterHasPartner();
          this.hunterKilledDuringDayVote = true;
          this.io.emit('hunter:pick-required');
        }
        await this.segmentsManager.audioManager.playDayVoteLoversDeath();
      }

      if (player.getRole() === 'WITCH') {
        this.segmentsManager.witchDied();
      }

      // Kill the player and clear votes
      this.game.handleDayVotePlayer(player);

      if (!this.segmentsManager.isGameOver()) {
        this.segmentsManager.finishSegment();
      }
    }
  }
}
