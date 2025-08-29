import type { DeathInfo } from '@repo/types';
import type { AudioManager } from '@/segments/audio-manager';
import type { SocketType } from '@/server/sockets';
import type { Game } from './game';

export class GameActions {
  private readonly game: Game;
  private readonly io: SocketType;
  private readonly audioManager: AudioManager;

  constructor(game: Game, io: SocketType, audioManager: AudioManager) {
    this.game = game;
    this.io = io;
    this.audioManager = audioManager;
  }

  cupidAction() {
    const cupid = this.game.getSpecialRolePlayer('CUPID');
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
    const witch = this.game.getSpecialRolePlayer('WITCH');
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
    const witch = this.game.getSpecialRolePlayer('WITCH');

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
  }

  handleWerewolfUpdateVote(
    socketId: string,
    targetPlayer: string,
    oldVote: string
  ) {
    this.game.handleWerewolfUpdateVote(socketId, targetPlayer, oldVote);
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

  async dayAction() {
    this.game.processPendingDeaths();
    const winner = this.game.checkIfWinner();
    if (winner) {
      await this.audioManager.playWinnerAudio(winner);
      this.game.alertWinnersAndLosers(winner);
      return;
    }

    setTimeout(() => {
      this.io.emit('day:voting-phase-start');
    }, 7000);
  }

  hunterAction() {
    setTimeout(() => {
      this.io.emit('hunter:pick-required');
    }, 18_000);
  }
}
