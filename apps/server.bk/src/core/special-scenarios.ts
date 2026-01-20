import type { Game } from '@/core/game';
import type { AudioManager } from '@/segments/audio-manager';

export class SpecialScenarios {
  game: Game;
  audioManager: AudioManager;
  specialScenarios: Map<string, () => void> = new Map();
  hunterDiedFirst = false;

  constructor(game: Game, audioManager: AudioManager) {
    this.game = game;
    this.audioManager = audioManager;
  }

  async partnerIsHunter() {
    this.hunterDiedFirst = true;
    await this.audioManager.nightHasEndedAudio();
    await this.audioManager.playLoverAudio();
    await this.audioManager.playSecondLoverIsHunterAudio();
  }

  async hunterIsLover() {
    await this.audioManager.nightHasEndedAudio();
    await this.audioManager.playHunterIsLoverAudio();
  }
}
