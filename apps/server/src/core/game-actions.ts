import type { SocketType } from '@/server/sockets';
import type { Game } from './game';

export class GameActions {
  private readonly game: Game;
  private readonly io: SocketType;

  constructor(game: Game, io: SocketType) {
    this.game = game;
    this.io = io;
  }

  cupidAction() {
    const cupid = this.game.getSpecialRolePlayers('CUPID');
    console.log(`cupid is ${cupid?.getName()}`);
    const socket = cupid?.getSocketId();
    if (!socket) {
      throw new Error('Cupid player not found');
    }
    this.io.to(socket).emit('cupid:pick-required');
  }

  loversAction() {
    const lovers = this.game.getLovers();

    this.io
      .to(lovers[0].getSocketId())
      .emit('alert:player-is-lover', lovers[1].getSocketId());
    this.io
      .to(lovers[1].getSocketId())
      .emit('alert:player-is-lover', lovers[0].getSocketId());

    // Enable the close button after a delay, like in the mobile app
    setTimeout(() => {
      this.io.to(lovers[0].getSocketId()).emit('alert:lovers-can-close-alert');
      this.io.to(lovers[1].getSocketId()).emit('alert:lovers-can-close-alert');
    }, 3000); // 3 second delay to match mobile app timing
  }

  werewolfAction() {
    for (const werewolf of this.game.getWerewolfList()) {
      console.log(werewolf);
      this.io.to(werewolf.getSocketId()).emit('werewolf:pick-required');
    }
  }

  handleWerewolfVote(socketId: string, targetPlayer: string) {
    this.game.handleWerewolfVote(socketId, targetPlayer);
    this.broadcastWerewolfVotes();
  }

  handleWerewolfUpdateVote(
    socketId: string,
    targetPlayer: string,
    oldVote: string
  ) {
    this.game.handleWerewolfUpdateVote(socketId, targetPlayer, oldVote);
    this.broadcastWerewolfVotes();
  }

  private broadcastWerewolfVotes() {
    const voteTallies = this.game.getWerewolfVoteTallies();
    const werewolves = this.game.getWerewolfList();

    for (const werewolf of werewolves) {
      this.io
        .to(werewolf.getSocketId())
        .emit('werewolf:current-votes', voteTallies);
    }
  }
}
