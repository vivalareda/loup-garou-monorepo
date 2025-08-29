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
    this.audioManager = audioManager;
    this.gameActions = new GameActions(game, io, audioManager);
    this.currentSegment = 0;
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
      skip: false,
    };

    const loversSegment: Segment = {
      type: 'LOVERS',
      action: () => this.gameActions.loversAction(),
      skip: false,
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
      skip: true,
    };

    const daySegment: Segment = {
      type: 'DAY',
      action: () => this.gameActions.dayAction(),
      skip: false,
    };

    const hunterSegment: Segment = {
      type: 'HUNTER',
      action: () => this.gameActions.hunterAction(),
      skip: true,
    };

    this.initializeSegment(cupidSegment);
    this.initializeSegment(loversSegment);
    this.initializeSegment(werewolfSegment);
    this.initializeSegment(witchHealSegment);
    this.initializeSegment(witchPoisonSegment);
    this.initializeSegment(daySegment);
    this.initializeSegment(hunterSegment);
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

  runHunterSegment() {
    this.audioManager.playHunterAudio();
    const hunterSegment = this.segments.find(
      (segment) => segment.type === 'HUNTER'
    );

    if (!hunterSegment) {
      throw new Error('hunter segment not inialized');
    }

    this.game.updateHunterPlayerList();

    hunterSegment.action();
  }

  isHunterInDeathQueue() {
    return this.game.hunterIsInDeathQueue();
  }

  isOneOfLoversInDeathQueue() {
    return this.game.isOneOfLoversInDeathQueue();
  }

  async runLoverSegment() {
    const segment = this.segments[this.currentSegment];
    await this.audioManager.playLoverAudio();
    if (!this.isGameOver()) {
      segment.action();
    }
  }

  async playSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);

    if (segment.type === 'DAY') {
      if (this.isHunterInDeathQueue()) {
        this.runHunterSegment();
        return;
      }

      if (this.isOneOfLoversInDeathQueue()) {
        this.runLoverSegment();
        return;
      }
    }

    await this.audioManager.playSegmentAudio(segment.type, true);
    segment.action();
  }

  continueDayAction() {
    if (this.isGameOver()) {
      return;
    }
    this.audioManager.playPostHunterAudio();
    const segment = this.segments[this.currentSegment];
    segment.action();
  }

  isGameOver() {
    const winner = this.game.checkIfWinner();

    if (winner === 'villagers') {
      this.audioManager.playVillagersWonAudio();
      this.game.alertWinnersAndLosers(winner);
      return true;
    }

    if (winner === 'werewolves') {
      this.audioManager.playWerewolvesWonAudio();
      this.game.alertWinnersAndLosers(winner);
      return true;
    }

    return false;
  }

  async finishSegment() {
    const segment = this.segments[this.currentSegment];
    await this.audioManager.playSegmentAudio(segment.type, false);

    this.markFirstNightSegment(segment);

    this.currentSegment++;
    this.findValidSegment();

    this.playSegment();
  }
}
