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
    // TODO: change this back to 0
    this.currentSegment = 2;
    this.initializeSegments();
  }

  initializeSegment(segment: Segment) {
    this.segments.push(segment);
  }

  getGameActions() {
    return this.gameActions;
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
      skip: false,
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
    return type === 'CUPID' || type === 'LOVERS';
  }

  markFirstNightSegment(segment: Segment) {
    if (!this.isFirstNightSegment(segment.type)) {
      return;
    }
    segment.skip = true;
  }

  // async handleNightEnd() {
  //   await this.playAudio('Wake-up-everyone');
  //
  //   // Process night deaths and play appropriate audio
  //   const deaths = this.game.processPendingDeaths();
  //
  //   if (deaths.length === 0) {
  //     await this.playAudio('Night-end/No-deaths');
  //     return;
  //   }
  //
  //   // Check for special death scenarios
  //   const hasLoverDeath = deaths.some(
  //     (d: DeathInfo) => d.cause === 'LOVER_SUICIDE'
  //   );
  //   const hasHunterDeath = deaths.some((d: DeathInfo) => d.metadata?.hunterId);
  //
  //   if (hasLoverDeath) {
  //     await this.playAudio('Special-death/Lover-Death');
  //   } else if (hasHunterDeath) {
  //     await this.playAudio('Day-vote/Hunter');
  //   } else {
  //     await this.playAudio('Night-end/Deaths');
  //   }
  //
  //   // Announce deaths to players
  //   this.gameActions.announceNightDeaths(deaths);
  // }

  async playSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(`[SEGMENT] Playing segment: ${segment.type}`);

    // if (segment.type === 'WITCH-HEAL') {
    //   if (!this.game.canWitchHeal()) {
    //     console.log('[SEGMENT] Skipping WITCH-HEAL - potion not available');
    //     return;
    //   }
    //   await this.audioManager.playSegmentAudio(segment.type, true);
    //   segment.action();
    //   return;
    // }
    //
    // if (segment.type === 'WITCH-POISON') {
    //   if (!this.game.canWitchPoison()) {
    //     console.log('[SEGMENT] Skipping WITCH-POISON - potion not available');
    //     return;
    //   }
    //   await this.audioManager.playSegmentAudio(segment.type, true);
    //   segment.action();
    //   return;
    // }

    await this.audioManager.playSegmentAudio(segment.type, true);
    segment.action();
  }

  async finishSegment() {
    const segment = this.segments[this.currentSegment];
    await this.audioManager.playSegmentAudio(segment.type, false);

    this.markFirstNightSegment(segment);
    this.currentSegment++;
    this.findValidSegment();

    console.log('Playing next segment:', this.currentSegment);
    this.playSegment();
  }
}
