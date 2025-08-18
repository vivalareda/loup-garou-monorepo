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
    const socket = cupid?.getSocket();
    if (!socket) {
      throw new Error('Cupid player not found');
    }
    this.io.to(socket).emit('action:cupid-pick-required');
  }

  loversAction() {
    const lovers = this.game.getLovers();

    this.io
      .to(lovers[0].getSocket())
      .emit('alert:player-is-lover', lovers[1].getSocket());
    this.io
      .to(lovers[1].getSocket())
      .emit('alert:player-is-lover', lovers[0].getSocket());
  }
}
