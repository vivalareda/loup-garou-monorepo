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

  async runHunterSegment() {
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
      this.audioManager.playHunterAudio();
    }
    const hunterSegment = this.segments.find(
      (segment) => segment.type === 'HUNTER'
    );

    if (!hunterSegment) {
      throw new Error('hunter segment not inialized');
    }

    this.game.updateHunterPlayerList();

    setTimeout(() => {
      hunterSegment.action();
    }, 18_000);
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

  checkPostDayVoteScenarios(): boolean {
    if (this.isHunterInDeathQueue()) {
      console.log('[CONSOLE AUDIO] Would play Hunter audio files');
      this.runHunterSegment();
      return true;
    }

    if (this.isOneOfLoversInDeathQueue()) {
      if (this.game.isPartnerHunter()) {
        console.log('[CONSOLE AUDIO] Would play lover-hunter special scenario audio');
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
      if (this.isHunterInDeathQueue()) {
        this.runHunterSegment();
        return;
      }

      if (this.isOneOfLoversInDeathQueue()) {
        if (this.game.isPartnerHunter()) {
          const hunterSegment = this.segments.find((s) => s.type === 'HUNTER');
          if (!hunterSegment) {
            throw new Error('hunter segment not inialized');
          }

          this.specialScenarios.partnerIsHunter();
          this.game.updateHunterPlayerList();
          hunterSegment.action();
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
    if (this.specialScenarios.hunterDiedFirst) {
      this.audioManager.playPostHunterAudio();
      this.specialScenarios.hunterDiedFirst = false;
    } else {
      this.audioManager.playDayVoteAudio();
    }

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
