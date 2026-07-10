import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import sound from 'sound-play';
import type { DeathManager } from '@/core/death-manager';

export class AudioManager {
  deathManager: DeathManager;

  constructor(deathManager: DeathManager) {
    this.deathManager = deathManager;
  }

  async playDayVoteHunterHasPartner() {
    await this.playDayEndAudio();
    await this.playAudio('Day-vote/Hunter');
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
      case 'HUNTER':
        return 'not implemented yet';
      case 'DAY':
        return this.getDeathAnnouncementAudio();
      default:
        throw new Error(
          `No start audio defined for segment: ${segment satisfies never}`
        );
    }
  }

  getSegmentEndAudio(segment: Exclude<SegmentType, 'HUNTER'>) {
    switch (segment) {
      case 'CUPID':
        return 'Cupidon/Cupidon-2';
      case 'LOVERS':
        return 'Lovers/Lover-3';
      case 'WEREWOLF':
        return 'Werewolves/Werewolves-2';
      case 'WITCH-HEAL':
        return 'not implemented yet';
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

  async playDayEndAudio() {
    await this.playAudio('Day-vote/Vote-Death');
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
      return 'Night-end/one-death';
    }

    return 'Night-end/no-death';
  }

  async playSpecialScenarioAudio(scenario: string) {
    switch (scenario) {
      case 'hunter died and has lover':
        console.log('player hunter died and has lover audio');
        await this.playAudio('Special-death/pre-day-vote-hunter-has-lover');
        break;
      default:
        throw new Error('special scenario audio doest exist');
    }
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

      switch (segment) {
        case 'LOVERS':
          // Dont wait for the audio to finish if it's the lovers or day segment
          this.playAudio(startAudioFile);
          break;
        case 'DAY':
          await this.playAudio('Night-end/Wake-up-everyone');
          await this.playAudio(this.getDeathAnnouncementAudio());
          await this.playAudio('day-vote-start');
          break;
        default:
          await this.playAudio(startAudioFile);
      }
      // Return early after playing start audio - don't play ending audio yet!
      return;
    }

    // Only play ending audio when isStarting = false
    if (segment === 'HUNTER') {
      return;
    }

    const lastAudioFile = this.getSegmentEndAudio(segment);

    if (!lastAudioFile) {
      // This mean we would be inside the WITCH-HEAL segment and we need to skip it
      return;
    }

    await this.playAudio(lastAudioFile);
  }

  async playHunterAudio() {
    await this.playAudio('Night-end/Wake-up-everyone');
    await this.playAudio('Night-end/Deaths');
    await this.playAudio('Hunter/Hunter');
  }

  async playSecondLoverIsHunterAudio() {
    console.log('playing Pre-day-vote/Second-lover-hunter');
    await this.playAudio('Pre-day-vote/Second-lover-hunter');
  }

  async playDayVoteAudio() {
    await this.playAudio('day-vote-start-universal');
  }

  async playDayVoteLoversDeath() {
    await this.playDayEndAudio();
    await this.playAudio('Day-vote/Lover');
  }

  async playPostHunterAudio() {
    await this.playAudio('Hunter/Hunter-start-vote');
  }

  async nightHasEndedAudio() {
    await this.playAudio('Night-end/Wake-up-everyone');
  }

  async playHunterIsLoverAudio() {
    await this.playAudio('Special-scenarios/hunter-is-lover');
    await this.playAudio('day-vote-start');
  }

  async playHunterKilledLover() {
    await this.playAudio('Night-end/hunter-killed-lover');
  }

  async playLoverAudio() {
    await this.playAudio('Night-end/Wake-up-everyone');
    await this.playAudio('Special-death/pre-day-vote-lover-2');
    await this.playAudio('day-vote-start');
  }

  async playWinnerAudio(winner: 'werewolves' | 'villagers') {
    if (winner === 'werewolves') {
      await this.playWerewolvesWonAudio();
      return;
    }

    await this.playVillagersWonAudio();
  }

  async playAudio(file: string) {
    try {
      if (!existsSync(`./assets/${file}.mp3`)) {
        return;
      }
      await sound.play(`./assets/${file}.mp3`);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }
}
