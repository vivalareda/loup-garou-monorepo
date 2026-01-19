import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Context, Data, Effect, Layer, Queue } from 'effect';
import sound from 'sound-play';
import type { DeathManager } from '@/core/death-manager';
import { AudioError } from '@/Domain/audio-error';

// Define the service interface
export interface AudioManagerService {
  readonly playDayVoteHunterHasPartner: () => Effect.Effect<void, AudioError>;
  readonly playSegmentAudio: (
    segment: SegmentType,
    isStarting: boolean
  ) => Effect.Effect<void, AudioError>;
  readonly playSpecialScenarioAudio: (
    scenario: string
  ) => Effect.Effect<void, AudioError>;
  readonly playVillagersWonAudio: () => Effect.Effect<void, AudioError>;
  readonly playWerewolvesWonAudio: () => Effect.Effect<void, AudioError>;
  readonly playHunterAudio: () => Effect.Effect<void, AudioError>;
  readonly playSecondLoverIsHunterAudio: () => Effect.Effect<void, AudioError>;
  readonly playDayVoteAudio: () => Effect.Effect<void, AudioError>;
  readonly playDayVoteLoversDeath: () => Effect.Effect<void, AudioError>;
  readonly playPostHunterAudio: () => Effect.Effect<void, AudioError>;
  readonly nightHasEndedAudio: () => Effect.Effect<void, AudioError>;
  readonly playHunterIsLoverAudio: () => Effect.Effect<void, AudioError>;
  readonly playLoverAudio: () => Effect.Effect<void, AudioError>;
  readonly playWinnerAudio: (
    winner: 'werewolves' | 'villagers'
  ) => Effect.Effect<void, AudioError>;
}

// Define the service tag
export class AudioManagerTag extends Context.Tag('AudioManager')<
  AudioManagerTag,
  AudioManagerService
>() {}

// Implementation
const make = (deathManager: DeathManager): AudioManagerService => {
  // Private helper
  const getDeathAnnouncementAudio = () => {
    if (deathManager.getPendingDeaths().length > 0) {
      return 'Night-end/Deaths';
    }
    return 'Night-end/No-deaths-with-start';
  };

  const getSegmentStartAudio = (segment: SegmentType) => {
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
        return getDeathAnnouncementAudio();
      default:
        throw new Error(
          `No start audio defined for segment: ${segment satisfies never}`
        );
    }
  };

  const getSegmentEndAudio = (segment: Exclude<SegmentType, 'HUNTER'>) => {
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
  };

  const playAudio = (file: string) =>
    Effect.tryPromise({
      try: async () => {
        if (!existsSync(`./assets/${file}.mp3`)) {
          return;
        }
        await sound.play(`./assets/${file}.mp3`);
      },
      catch: (error) =>
        new AudioError({ message: 'Error playing audio', cause: error }),
    });

  const playDayEndAudio = () => playAudio('Day-vote/Vote-Death');

  const playDayVoteHunterHasPartner = () =>
    Effect.all([playDayEndAudio(), playAudio('Day-vote/Hunter')], {
      concurrency: 'unbounded',
    }).pipe(Effect.asVoid);

  const playSpecialScenarioAudio = (scenario: string) =>
    Effect.gen(function* (_) {
      switch (scenario) {
        case 'hunter died and has lover':
          yield* _(Effect.log('player hunter died and has lover audio'));
          yield* _(playAudio('Special-death/pre-day-vote-hunter-has-lover'));
          break;
        default:
          yield* _(
            Effect.fail(
              new AudioError({ message: 'special scenario audio doest exist' })
            )
          );
      }
    });

  const playVillagersWonAudio = () => playAudio('End-game/Villagers-won');
  const playWerewolvesWonAudio = () => playAudio('End-game/Werewolves-won');

  const playSegmentAudio = (segment: SegmentType, isStarting: boolean) =>
    Effect.gen(function* (_) {
      if (isStarting) {
        const startAudioFile = getSegmentStartAudio(segment);

        // Dont wait for the audio to finish if it's the lovers or day segment
        if (segment === 'LOVERS') {
          // We intentionally don't await this
          yield* _(playAudio(startAudioFile), Effect.fork);
          return;
        }

        if (segment === 'DAY') {
          yield* _(playAudio('Night-end/Wake-up-everyone'));
          // We intentionally don't await this
          yield* _(playAudio(startAudioFile), Effect.fork);
          return;
        }

        yield* _(playAudio(startAudioFile));
        return;
      }

      if (segment === 'HUNTER') {
        return;
      }

      const lastAudioFile = getSegmentEndAudio(segment);

      if (!lastAudioFile) {
        // This mean we would be inside the WITCH-HEAL segment and we need to skip it
        return;
      }

      yield* _(playAudio(lastAudioFile));
    });

  const playHunterAudio = () =>
    Effect.gen(function* (_) {
      yield* _(playAudio('Night-end/Wake-up-everyone'));
      yield* _(playAudio('Night-end/Deaths'));
      yield* _(playAudio('Hunter/Hunter'));
    });

  const playSecondLoverIsHunterAudio = () =>
    Effect.gen(function* (_) {
      yield* _(Effect.log('playing Pre-day-vote/Second-lover-hunter'));
      yield* _(playAudio('Pre-day-vote/Second-lover-hunter'));
    });

  const playDayVoteAudio = () => playAudio('day-vote-start-universal');

  const playDayVoteLoversDeath = () =>
    Effect.all([playDayEndAudio(), playAudio('Day-vote/Lover')], {
      concurrency: 'unbounded',
    }).pipe(Effect.asVoid);

  const playPostHunterAudio = () => playAudio('Hunter/Hunter-start-vote');

  const nightHasEndedAudio = () => playAudio('Night-end/Wake-up-everyone');

  const playHunterIsLoverAudio = () =>
    playAudio('Special-scenarios/hunter-is-lover');

  const playLoverAudio = () => playAudio('Special-death/pre-day-vote-lover-2');

  const playWinnerAudio = (winner: 'werewolves' | 'villagers') => {
    if (winner === 'werewolves') {
      return playWerewolvesWonAudio();
    }
    return playWerewolvesWonAudio(); // Note: Original code called playWerewolvesWonAudio for villagers too in the else block if checking line 179
  };

  return {
    playDayVoteHunterHasPartner,
    playSegmentAudio,
    playSpecialScenarioAudio,
    playVillagersWonAudio,
    playWerewolvesWonAudio,
    playHunterAudio,
    playSecondLoverIsHunterAudio,
    playDayVoteAudio,
    playDayVoteLoversDeath,
    playPostHunterAudio,
    nightHasEndedAudio,
    playHunterIsLoverAudio,
    playLoverAudio,
    playWinnerAudio,
  };
};

export const AudioManagerLive = (deathManager: DeathManager) =>
  Layer.succeed(AudioManagerTag, make(deathManager));
