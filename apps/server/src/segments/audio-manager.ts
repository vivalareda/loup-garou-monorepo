import { existsSync } from 'node:fs';

import type { SegmentType } from '@repo/types';
import sound from 'sound-play';
import type { DeathManager } from '@/core/death-manager';

export class AudioManager {
  deathManager: DeathManager;

  constructor(deathManager: DeathManager) {
    this.deathManager = deathManager;
  }

  getSegmentStartAudio(segment: SegmentType) {
    switch (segment) {
      case 'CUPID':
        return 'Cupidon/Cupidon-1';
      case 'LOVERS':
        return 'Lovers/combined_lover';
      case 'WEREWOLF':
        return 'Werewolves/Werewolves-1';
      case 'WITCH-HEAL':
        return 'Witch/Witch-wake-up';
      case 'WITCH-POISON':
        return 'Witch/Witch-poison';
      case 'DAY':
        return this.getDeathAnnouncementAudio();
      default:
        throw new Error(
          `No start audio defined for segment: ${segment satisfies never}`
        );
    }
  }

  getSegmentEndAudio(segment: SegmentType) {
    switch (segment) {
      case 'CUPID':
        return 'Cupidon/Cupidon-2';
      case 'LOVERS':
        return 'Lovers/Lover-3';
      case 'WEREWOLF':
        return 'Werewolves/Werewolves-2';
      case 'WITCH-HEAL':
        return;
      case 'WITCH-POISON':
        return 'Witch/Witch-end';
      case 'DAY':
        return 'Day-vote/Vote-Death';
      default:
        throw new Error(
          `No start audio defined for segment: ${segment satisfies never}`
        );
    }
  }

  // isConditionnalEndingAudioSegment(segment: SegmentType) {
  //   if (segment === 'WITCH-HEAL') {
  //     // This segment doesn't have a specific ending audio
  //     return true;
  //   }
  //
  //   return false;
  // }

  getDeathAnnouncementAudio() {
    if (this.deathManager.getPendingDeaths().length > 0) {
      return 'Night-end/combined_audio';
    }

    return 'Night-end/No-deaths-with-start';
  }

  async playVillagersWonAudio() {
    await this.playAudio('End-game/Villagers-won');
  }

  async playWerewolvesWonAudio() {
    await this.playAudio('End-game/Werewolves-won');
  }

  async playSegmentAudio(segment: SegmentType, isStarting: boolean) {
    if (isStarting) {
      const startAudioFile = this.getSegmentStartAudio(segment);

      // Dont wait for the audio to finish if it's the lovers or day segment
      if (segment === 'LOVERS' || segment === 'DAY') {
        this.playAudio(startAudioFile);
        return;
      }

      await this.playAudio(startAudioFile);

      return;
    }

    const lastAudioFile = this.getSegmentEndAudio(segment);

    if (!lastAudioFile) {
      // This mean we would be inside the WITCH-HEAL segment and we need to skip it
      return;
    }

    await this.playAudio(lastAudioFile);
  }

  private async playAudio(file: string) {
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
