import { Effect } from 'effect';
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

  partnerIsHunter() {
    return Effect.gen({ self: this }, function* () {
      yield* this.audioManager.nightHasEndedAudio();
      // Don't call playLoverAudio() here as it includes wake-up audio
      yield* this.audioManager.playAudio('Special-death/pre-day-vote-lover-2');
      yield* this.audioManager.playSecondLoverIsHunterAudio();
    });
  }

  hunterIsLover() {
    return Effect.gen({ self: this }, function* () {
      yield* this.audioManager.nightHasEndedAudio();
      yield* this.audioManager.playHunterIsLoverAudio();
    });
  }
}
