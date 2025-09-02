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

  handleHunterPlayerPick(targetSid: string) {
    if (this.hunterKilledDuringDayVote) {
      this.handleDayVoteHunterPlayerPick(targetSid);
      return;
    }

    this.game.addPendingDeath(targetSid, 'HUNTER_REVENGE');
    this.game.isHunterInLove();
    this.game.killHunterRevenge(targetSid);
    this.segmentsManager.continueDayAction();
  }

  handleDayVoteHunterPlayerPick(targetSid: string) {
    this.game.killHunterRevenge(targetSid);
    this.game.isHunterInLove();
    this.game.killHunterRevenge(targetSid);
    this.segmentsManager.audioManager.playDayVoteAudio();
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

      if (!this.segmentsManager.isGameOver()) {
        this.segmentsManager.finishSegment();
      }
    }
  }
}
