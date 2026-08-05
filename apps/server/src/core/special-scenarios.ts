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

  async partnerIsHunter() {
    await this.audioManager.nightHasEndedAudio();
    // Don't call playLoverAudio() here as it includes wake-up audio
    await this.audioManager.playAudio('Special-death/pre-day-vote-lover-2');
    await this.audioManager.playSecondLoverIsHunterAudio();
  }

  async hunterIsLover() {
    await this.audioManager.nightHasEndedAudio();
    await this.audioManager.playHunterIsLoverAudio();
  }
}
