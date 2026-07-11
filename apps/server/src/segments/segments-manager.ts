import type { Segment } from '@repo/types';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import { NightDawnResolution } from '@/server/night-dawn-resolution';
import type { SocketType } from '@/server/sockets';

export class SegmentsManager {
  io: SocketType;
  game: Game;
  gameActions: GameActions;
  nightDawnResolution: NightDawnResolution;
  audioManager: AudioManager;
  currentSegment: number;
  segments: Segment[] = [];
  specialScenarios: SpecialScenarios;

  private cupidSegment!: Segment;
  private loversSegment!: Segment;
  private werewolfSegment!: Segment;
  private witchHealSegment!: Segment;
  private witchPoisonSegment!: Segment;
  private daySegment!: Segment;
  private hunterSegment!: Segment;

  constructor(
    game: Game,
    io: SocketType,
    audioManager: AudioManager,
    specialScenarios: SpecialScenarios
  ) {
    this.io = io;
    this.game = game;
    this.audioManager = audioManager;
    this.gameActions = new GameActions(game, io, audioManager);
    this.nightDawnResolution = new NightDawnResolution(game, this, io);
    this.specialScenarios = specialScenarios;
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
    this.witchHealSegment.skip = true;
    this.witchPoisonSegment.skip = true;
  }

  initializeSegments() {
    this.cupidSegment = {
      type: 'CUPID',
      action: () => this.gameActions.cupidAction(),
      skip: true,
    };

    this.loversSegment = {
      type: 'LOVERS',
      action: () => this.gameActions.loversAction(),
      skip: true,
    };

    this.werewolfSegment = {
      type: 'WEREWOLF',
      action: () => this.gameActions.werewolfAction(),
      skip: false,
    };

    this.witchHealSegment = {
      type: 'WITCH-HEAL',
      action: () => this.gameActions.witchHealAction(),
      skip: false,
    };

    this.witchPoisonSegment = {
      type: 'WITCH-POISON',
      action: () => this.gameActions.witchPoisonAction(),
      skip: false,
    };

    this.daySegment = {
      type: 'DAY',
      action: () => this.gameActions.dayAction(),
      skip: false,
    };

    this.hunterSegment = {
      type: 'HUNTER',
      action: () => this.gameActions.hunterAction(),
      skip: true,
    };

    this.initializeSegment(this.cupidSegment);
    this.initializeSegment(this.loversSegment);
    this.initializeSegment(this.werewolfSegment);
    this.initializeSegment(this.witchHealSegment);
    this.initializeSegment(this.witchPoisonSegment);
    this.initializeSegment(this.daySegment);
    this.initializeSegment(this.hunterSegment);
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

  isHunterInDeathQueue() {
    return this.game.hunterIsInDeathQueue();
  }

  markWitchPoisonAsSkipped() {
    this.witchPoisonSegment.skip = true;
  }

  isOneOfLoversInDeathQueue() {
    return this.game.isOneOfLoversInDeathQueue();
  }

  async playSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);

    if (segment.type === 'DAY') {
      // Dawn (night-death reveal + day start) runs as one resolution
      // program; it pauses internally when the hunter must pick
      this.nightDawnResolution.run().catch((error) => {
        console.error('night dawn resolution failed:', error);
      });
      return;
    }

    await this.audioManager.playSegmentAudio(segment.type, true);
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
    await this.advanceSegment();
  }

  // playEndAudio: false lets callers that already narrated the segment's
  // outcome (day-vote resolution, tie) move on without the generic end audio
  async advanceSegment({ playEndAudio = true }: { playEndAudio?: boolean } = {}) {
    const segment = this.segments[this.currentSegment];

    if (playEndAudio) {
      await this.audioManager.playSegmentAudio(segment.type, false);
    }

    this.markFirstNightSegment(segment);

    this.currentSegment++;
    this.findValidSegment();

    this.playSegment();
  }
}
