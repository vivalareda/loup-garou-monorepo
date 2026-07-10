import type { Segment } from '@repo/types';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import type { SocketType } from '@/server/sockets';

export class SegmentsManager {
  io: SocketType;
  game: Game;
  gameActions: GameActions;
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

  async runHunterSegment() {
    console.log('running hunter segment');
    const hunter = this.game.getSpecialRolePlayer('HUNTER');
    if (!hunter) {
      throw new Error(
        'tried to play hunter segment but hunter player not found'
      );
    }
    const isLover = this.game.isPlayerLover(hunter);

    if (isLover) {
      const partner = this.game.getPartner(hunter);
      if (!partner) {
        throw new Error('lover could not be found');
      }
      this.game.addPartnerSuicide(hunter.getSocketId(), partner.getSocketId());
      await this.specialScenarios.hunterIsLover();
    } else {
      await this.audioManager.playHunterAudio();
    }

    // Mark that hunter died first so the correct audio plays after hunter's revenge
    this.specialScenarios.hunterDiedFirst = true;

    // Direct property access - no need to find()
    this.game.updateHunterPlayerList();
    this.hunterSegment.action();
  }

  isHunterInDeathQueue() {
    return this.game.hunterIsInDeathQueue();
  }

  markWitchPoisonAsSkipped() {
    // Direct property access - no need to find()
    this.witchPoisonSegment.skip = true;
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

  checkPostDayVoteScenarios(): boolean {
    if (this.isHunterInDeathQueue()) {
      console.log('[CONSOLE AUDIO] Would play Hunter audio files');
      this.runHunterSegment();
      return true;
    }

    if (this.isOneOfLoversInDeathQueue()) {
      if (this.game.isPartnerHunter()) {
        console.log(
          '[CONSOLE AUDIO] Would play lover-hunter special scenario audio'
        );
        this.specialScenarios.partnerIsHunter();
        return true;
      }
      console.log('[CONSOLE AUDIO] Would play lover death audio');
      this.runLoverSegment();
      return true;
    }

    return false;
  }

  async playSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);

    if (segment.type === 'DAY') {
      console.log('isHunterInDeathQueue', this.isHunterInDeathQueue());
      if (this.isHunterInDeathQueue()) {
        this.runHunterSegment();
        return;
      }

      if (this.isOneOfLoversInDeathQueue()) {
        if (this.game.isPartnerHunter()) {
          // Direct property access - no need to find()
          this.specialScenarios.partnerIsHunter();
          this.game.updateHunterPlayerList();
          this.hunterSegment.action();
          return;
        }
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

    this.audioManager.playDayVoteAudio();
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
