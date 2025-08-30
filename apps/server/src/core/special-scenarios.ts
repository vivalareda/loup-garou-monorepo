import type { Game } from '@/core/game';
import type { AudioManager } from '@/segments/audio-manager';

export class SpecialScenarios {
  game: Game;
  audioManager: AudioManager;
  specialScenarios: Map<string, () => void> = new Map();

  constructor(game: Game, audioManager: AudioManager) {
    this.game = game;
    this.audioManager = audioManager;
  }

  secondLoverIsHunter() {
    this.audioManager.playLoverAudio();
    this.audioManager.playSecondLoverIsHunterAudio();
  }
}
