import { existsSync } from 'node:fs';
import { SEGMENTS, type Segment } from '@repo/types';
import sound from 'sound-play';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SocketType } from '@/server/sockets';

export class SegmentsManager {
  io: SocketType;
  game: Game;
  gameActions: GameActions;
  currentSegment: number;
  segments: Segment[] = [];
  firstNightSegments: Segment[] = [];

  constructor(game: Game, io: SocketType) {
    this.io = io;
    this.game = game;
    this.gameActions = new GameActions(game, io);
    this.currentSegment = 0;
    this.initializeSegments();
  }

  initializeSegment(segment: Segment) {
    this.segments.push(segment);
  }

  initializeSegments() {
    const cupidSegment: Segment = {
      type: 'CUPID',
      audioFiles: ['Cupidon/Cupidon-1', 'Cupidon/Cupidon-2'],
      action: () => this.gameActions.cupidAction(),
      onFirstNightOnly: true,
      skip: false,
    };

    const loversSegment: Segment = {
      type: 'LOVERS',
      audioFiles: ['Lovers/Lover-1-fixed', 'Lovers/Lover-2', 'Lovers/Lover-3'],
      action: () => this.gameActions.loversAction(),
      onFirstNightOnly: true,
      skip: false,
    };

    this.initializeSegment(cupidSegment);
    this.initializeSegment(loversSegment);
  }

  firstNightSegment() {
    //TODO: add intro back audio (need to put async in front of firstNightSegment)
    // await this.playAudio('Intro');
    this.playSement();
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

  async playSegment() {
    const segment = this.segments[this.currentSegment];

    if (segment.type === SEGMENTS[1]) {
      await this.playAudio(segment.audioFiles[0]);
      segment.action();
      await this.playAudio(segment.audioFiles[1]);
      return;
    }

    if (segment.type === SEGMENTS[3]) {
      segment.action();
      return;
    }

    await this.playAudio(segment.audioFiles[0]);
    segment.action();
  }

  async finishSegment() {
    const segment = this.segments[this.currentSegment];

    if (!segment.skip && segment.audioFiles.length > 1) {
      await this.playAudio(segment.audioFiles[-1]);
    }

    this.currentSegment++;

    this.findValidSegment();

    await this.playSegment();
  }

  async playSement() {
    const segment = this.segments[this.currentSegment];

    if (!segment) {
      throw new Error(`Segment not found: ${this.currentSegment}`);
    }

    await this.playAudio(segment.audioFiles[0]);
    segment.action();
  }

  async playAudio(file: string) {
    try {
      if (!existsSync(`./assets/${file}.mp3`)) {
        console.error(`Audio file not found: ./assets/${file}.mp3`);
        return;
      }
      console.log(`Playing audio: ./assets/${file}.mp3`);
      await sound.play(`./assets/${file}.mp3`);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }
}
