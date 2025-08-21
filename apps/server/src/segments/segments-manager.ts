import { existsSync } from 'node:fs';
import type { Segment } from '@repo/types';
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
      skip: false,
    };

    const loversSegment: Segment = {
      type: 'LOVERS',
      audioFiles: ['Lovers/combined_lover', 'Lovers/Lover-3'],
      action: () => this.gameActions.loversAction(),
      skip: false,
    };

    const werewolfSegment: Segment = {
      type: 'WEREWOLF',
      audioFiles: ['Werewolf/Werewolf-1', 'Werewolf/Werewolf-2'],
      action: () => this.gameActions.werewolfAction(),
      skip: false,
    };

    this.initializeSegment(cupidSegment);
    this.initializeSegment(loversSegment);
    this.initializeSegment(werewolfSegment);
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

  async playSegment() {
    const segment = this.segments[this.currentSegment];

    if (segment.type === 'LOVERS') {
      this.playAudio(segment.audioFiles[0]);
      setTimeout(() => {
        segment.action();
      }, 5000);
      return;
    }

    await this.playAudio(segment.audioFiles[0]);
    segment.action();
  }

  async finishSegment() {
    const segment = this.segments[this.currentSegment];
    console.log(
      `current segment: ${segment.type} and length is ${segment.audioFiles.length}`
    );

    if (!segment.skip && segment.audioFiles.length > 1) {
      const audioFile = segment.audioFiles.at(-1);

      if (!audioFile) {
        throw new Error(`No audio file found for segment: ${segment.type}`);
      }

      await this.playAudio(audioFile);
    }

    this.markFirstNightSegment(segment);
    this.currentSegment++;
    this.findValidSegment();

    await this.playSegment();
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
