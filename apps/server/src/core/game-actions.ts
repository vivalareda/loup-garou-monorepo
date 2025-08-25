import type { DeathInfo } from '@repo/types';
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
    const socket = cupid?.getSocketId();
    if (!socket) {
      throw new Error('Cupid player not found');
    }
    this.io.to(socket).emit('cupid:pick-required');
  }

  loversAction() {
    const lovers = this.game.getLovers();

    // Wait a few seconds before prompting the cupid to pick lovers since lover audio file isn't awaited
    setTimeout(() => {
      this.io
        .to(lovers[0].getSocketId())
        .emit('alert:player-is-lover', lovers[1].getSocketId());
      this.io
        .to(lovers[1].getSocketId())
        .emit('alert:player-is-lover', lovers[0].getSocketId());
    }, 4000);

    // *This is for the dashboard only* Enable the close button after a delay, like in the mobile app
    setTimeout(() => {
      this.io.to(lovers[0].getSocketId()).emit('alert:lovers-can-close-alert');
      this.io.to(lovers[1].getSocketId()).emit('alert:lovers-can-close-alert');
    }, 3000); // 3 second delay to match mobile app timing
  }

  werewolfAction() {
    for (const werewolf of this.game.getWerewolfList()) {
      this.io.to(werewolf.getSocketId()).emit('werewolf:pick-required');
    }
  }

  witchHealAction() {
    const witch = this.game.getSpecialRolePlayers('WITCH');
    const werewolfVictimSid = this.game.getWerewolfTarget();

    if (!witch) {
      console.log('No witch in the game, skipping witch heal action');
      return;
    }

    if (!werewolfVictimSid) {
      throw new Error(
        'No werewolf victim found - werewolves may not have reached agreement'
      );
    }

    this.io.to(witch.getSocketId()).emit('witch:can-heal', werewolfVictimSid);
  }

  witchPoisonAction() {
    const witch = this.game.getSpecialRolePlayers('WITCH');

    console.log(`[WITCH-POISON] Witch found: ${witch === undefined}`);

    if (!witch) {
      console.error('Witch player not found');
      return;
    }

    console.log(
      `[WITCH-POISON] Emitting poison prompt to witch ${witch.getName()}`
    );
    this.io.to(witch.getSocketId()).emit('witch:pick-poison-player');
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

  broadcastWerewolfVotes() {
    const voteTallies = this.game.getWerewolfVoteTallies();
    const werewolves = this.game.getWerewolfList();

    for (const werewolf of werewolves) {
      this.io
        .to(werewolf.getSocketId())
        .emit('werewolf:current-votes', voteTallies);
    }
  }

  announceNightDeaths(deaths: DeathInfo[]) {
    this.io.emit('night:deaths-announced', deaths);

    for (const death of deaths) {
      console.log(
        `Announcing death: Player ${death.playerId} died from ${death.cause}`
      );
    }
  }

  dayAction() {
    setTimeout(() => {
      this.game.processPendingDeaths();
    }, 7000);
    setTimeout(() => {
      this.io.emit('day:voting-phase-start');
    }, 15_000);
  }
}
