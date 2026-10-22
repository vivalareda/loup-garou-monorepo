import type { SegmentType } from '@repo/types';
import { Effect } from 'effect';
import type { DeathManager } from '@/core/death-manager';
import { type Narrator, silentNarrator } from './narrator';

/**
 * Narration as Effects: a sequence of clips runs one clip after the
 * other, and interrupting the fiber that runs it (its segment ended, the
 * game finished or was reset) stops it before the next clip.
 */
export class AudioManager {
  deathManager: DeathManager;
  private readonly narrator: Narrator;

  constructor(deathManager: DeathManager, narrator: Narrator = silentNarrator) {
    this.deathManager = deathManager;
    this.narrator = narrator;
  }

  playDayVoteHunterHasPartner() {
    return Effect.gen({ self: this }, function* () {
      yield* this.playDayEndAudio();
      yield* this.playAudio('Day-vote/Hunter');
    });
  }

  getSegmentStartAudio(segment: SegmentType) {
    switch (segment) {
      case 'CUPID':
        return 'Cupidon/Cupidon-1';
      case 'LOVERS':
        return 'Lovers/combined_lover';
      case 'SEER':
        return 'Seer/Seer-wake-up';
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
      case 'SEER':
        return 'Seer/Seer-end';
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

  playDayEndAudio() {
    return this.playAudio('Day-vote/Vote-Death');
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

  playSpecialScenarioAudio(scenario: string) {
    return Effect.gen({ self: this }, function* () {
      switch (scenario) {
        case 'hunter died and has lover':
          console.log('player hunter died and has lover audio');
          yield* this.playAudio('Special-death/pre-day-vote-hunter-has-lover');
          break;
        default:
          throw new Error('special scenario audio doest exist');
      }
    });
  }

  playVillagersWonAudio() {
    return this.playAudio('End-game/Villagers-won');
  }

  playWerewolvesWonAudio() {
    return this.playAudio('End-game/Werewolves-won');
  }

  playSegmentAudio(segment: SegmentType, isStarting: boolean) {
    return Effect.gen({ self: this }, function* () {
      if (isStarting) {
        const startAudioFile = this.getSegmentStartAudio(segment);

        switch (segment) {
          case 'LOVERS':
            // Dont wait for the audio to finish if it's the lovers or day segment
            yield* Effect.forkDetach(this.playAudio(startAudioFile));
            break;
          case 'DAY':
            yield* this.playAudio('Night-end/Wake-up-everyone');
            yield* this.playAudio(this.getDeathAnnouncementAudio());
            yield* this.playAudio('day-vote-start');
            break;
          default:
            yield* this.playAudio(startAudioFile);
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

      yield* this.playAudio(lastAudioFile);
    });
  }

  playHunterAudio() {
    return Effect.gen({ self: this }, function* () {
      yield* this.playAudio('Night-end/Wake-up-everyone');
      yield* this.playAudio('Night-end/Deaths');
      yield* this.playAudio('Hunter/Hunter');
    });
  }

  playSecondLoverIsHunterAudio() {
    return Effect.gen({ self: this }, function* () {
      console.log('playing Pre-day-vote/Second-lover-hunter');
      yield* this.playAudio('Pre-day-vote/Second-lover-hunter');
    });
  }

  playDayVoteAudio() {
    return this.playAudio('day-vote-start-universal');
  }

  playDayVoteLoversDeath() {
    return Effect.gen({ self: this }, function* () {
      yield* this.playDayEndAudio();
      yield* this.playAudio('Day-vote/Lover');
    });
  }

  playPostHunterAudio() {
    return this.playAudio('Hunter/Hunter-start-vote');
  }

  nightHasEndedAudio() {
    return this.playAudio('Night-end/Wake-up-everyone');
  }

  playHunterIsLoverAudio() {
    return Effect.gen({ self: this }, function* () {
      yield* this.playAudio('Special-scenarios/hunter-is-lover');
      yield* this.playAudio('day-vote-start');
    });
  }

  playHunterKilledLover() {
    return this.playAudio('Night-end/hunter-killed-lover');
  }

  playLoverAudio() {
    return Effect.gen({ self: this }, function* () {
      yield* this.playAudio('Night-end/Wake-up-everyone');
      yield* this.playAudio('Special-death/pre-day-vote-lover-2');
      yield* this.playAudio('day-vote-start');
    });
  }

  playWinnerAudio(winner: 'werewolves' | 'villagers') {
    return Effect.gen({ self: this }, function* () {
      if (winner === 'werewolves') {
        yield* this.playWerewolvesWonAudio();

        return;
      }

      yield* this.playVillagersWonAudio();
    });
  }

  /**
   * Plays one clip. Interrupting it stops the wait, not the narrator:
   * the clip itself plays on, but nothing sequenced after it starts.
   */
  playAudio(file: string) {
    return Effect.promise(() => this.narrator.play(file));
  }
}
