import type { Segment } from '@repo/types';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { AudioManager } from '@/segments/audio-manager';
import type { SocketType } from '@/server/sockets';

export class SegmentsManager {
  io: SocketType;
  game: Game;
  gameActions: GameActions;
  audioManager: AudioManager;
  currentSegment: number;
  segments: Segment[] = [];

  constructor(game: Game, io: SocketType, audioManager: AudioManager) {
    this.io = io;
    this.game = game;
    this.gameActions = new GameActions(game, io);
    this.audioManager = audioManager;
    this.currentSegment = 2;
    this.initializeSegments();
  }

  initializeSegment(segment: Segment) {
    this.segments.push(segment);
  }

  getGameActions() {
    return this.gameActions;
  }

  witchDied() {
    const healSegment = this.segments.find((s) => s.type === 'WITCH-HEAL');
    const poisonSegment = this.segments.find((s) => s.type === 'WITCH-POISON');
    if (!(healSegment && poisonSegment)) {
      throw new Error('Witch heal or poison segment not found');
    }
    healSegment.skip = true;
    poisonSegment.skip = true;
  }

  initializeSegments() {
    const cupidSegment: Segment = {
      type: 'CUPID',
      action: () => this.gameActions.cupidAction(),
      skip: true,
    };

    const loversSegment: Segment = {
      type: 'LOVERS',
      action: () => this.gameActions.loversAction(),
      skip: true,
    };

    const werewolfSegment: Segment = {
      type: 'WEREWOLF',
      action: () => this.gameActions.werewolfAction(),
      skip: false,
    };

    const witchHealSegment: Segment = {
      type: 'WITCH-HEAL',
      action: () => this.gameActions.witchHealAction(),
      skip: true,
    };

    const witchPoisonSegment: Segment = {
      type: 'WITCH-POISON',
      action: () => this.gameActions.witchPoisonAction(),
      skip: false,
    };

    const daySegment: Segment = {
      type: 'DAY',
      action: () => this.gameActions.dayAction(),
      skip: false,
    };

    this.initializeSegment(cupidSegment);
    this.initializeSegment(loversSegment);
    this.initializeSegment(werewolfSegment);
    this.initializeSegment(witchHealSegment);
    this.initializeSegment(witchPoisonSegment);
    this.initializeSegment(daySegment);
  }

  startGame() {
    //TODO: add intro back audio (need to put async in front of firstNightSegment)
    // await this.playAudio('Intro');
    this.playSegment();
  }

  findValidSegment() {
    while (
      this.currentSegment < this.segments.length &&
      this.segments[this.currentSegment].skip
    ) {
      this.currentSegment++;
    }

    if (this.currentSegment >= this.segments.length) {
      this.currentSegment = 0;

      while (
        this.currentSegment < this.segments.length &&
        this.segments[this.currentSegment].skip
      ) {
        this.currentSegment++;
      }
    }
  }

  isFirstNightSegment(type: string) {
    console.log('Checking if segment is first night segment:', type);
    console.log(type === 'CUPID' || type === 'LOVERS');
    return type === 'CUPID' || type === 'LOVERS';
  }

  markFirstNightSegment(segment: Segment) {
    if (!this.isFirstNightSegment(segment.type)) {
      return;
    }
    segment.skip = true;
  }

  getCurrentSegmentType() {
    const segment = this.segments[this.currentSegment];

    return segment.type;
  }

  async playSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);

    await this.audioManager.playSegmentAudio(segment.type, true);
    segment.action();
  }

  isGameOver() {
    const winner = this.game.checkIfWinner();

    if (winner === 'villagers') {
      this.audioManager.playVillagersWonAudio();
      this.game.alertWinner(winner);
      return true;
    }

    if (winner === 'werewolves') {
      this.audioManager.playWerewolvesWonAudio();
      this.game.alertWinner(winner);
      return true;
    }

    return false;
  }

  async finishSegment() {
    const segment = this.segments[this.currentSegment];
    await this.audioManager.playSegmentAudio(segment.type, false);

    this.markFirstNightSegment(segment);

    // if (segment.type === 'DAY') {
    //   this.isGameOver();
    // }

    this.currentSegment++;
    this.findValidSegment();

    console.log('Playing next segment:', this.currentSegment);
    this.playSegment();
  }
}
