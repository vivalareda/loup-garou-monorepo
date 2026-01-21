import { Effect, Config } from 'effect';
import { existsSync } from 'node:fs';
import sound from 'sound-play';
import type { SegmentType } from '@repo/types';

export class AudioManager extends Effect.Service<AudioManager>()(
  '@app/AudioManager',
  {
    effect: Effect.gen(function* () {
      const assetsPath = yield* Config.string('ASSETS_PATH').pipe(
        Config.withDefault('./assets')
      );

      const playAudio = (file: string) =>
        Effect.tryPromise({
          try: async () => {
            const fullPath = `${assetsPath}/${file}.mp3`;
            if (!existsSync(fullPath)) {
              return;
            }
            await sound.play(fullPath);
          },
          catch: (error) => {
            console.error('Audio playback error (continuing):', error);
          },
        }).pipe(
          Effect.catchAll(() => Effect.void)
        );

      const playSegmentStart = (segment: SegmentType) =>
        Effect.gen(function* () {
          const audioFile = getSegmentStartAudio(segment);

          if (segment === 'LOVERS' || segment === 'DAY') {
            Effect.runFork(playAudio(audioFile));
            return;
          }

          yield* playAudio(audioFile);
        });

      const playSegmentEnd = (segment: SegmentType) =>
        Effect.gen(function* () {
          if (segment === 'HUNTER') {
            return;
          }
          const audioFile = getSegmentEndAudio(segment);
          if (!audioFile) return;
          yield* playAudio(audioFile);
        });

      return {
        playSegmentStart,

        playSegmentEnd,

        playSegmentAudio: (
          segment: SegmentType,
          isStarting: boolean
        ) =>
          Effect.gen(function* () {
            if (isStarting) {
              yield* playSegmentStart(segment);
              return;
            }

            if (segment === 'HUNTER') {
              return;
            }

            const endAudioFile = getSegmentEndAudio(segment);

            if (!endAudioFile) {
              return;
            }

            yield* playAudio(endAudioFile);
          }),

        playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
          playAudio(
            winner === 'werewolves'
              ? 'End-game/Werewolves-won'
              : 'End-game/Villagers-won'
          ),

        playVillagersWonAudio: playAudio('End-game/Villagers-won'),

        playWerewolvesWonAudio: playAudio('End-game/Werewolves-won'),

        nightHasEndedAudio: playAudio('Night/night-has-ended'),

        playLoverAudio: playAudio('Lovers/combined_lover'),

        playSecondLoverIsHunterAudio: playAudio(
          'Hunter/second-lover-is-hunter'
        ),

        playHunterIsLoverAudio: playAudio('Hunter/hunter-is-lover'),

        playHunterAudio: playAudio('Hunter/hunter'),

        playPostHunterAudio: playAudio('Hunter/Hunter-start-vote'),

        playDayEndAudio: playAudio('Day-vote/Vote-Death'),

        playDayVoteAudio: playAudio('day-vote-start-universal'),
      };
    }),
    dependencies: [],
  }
) {}

const getSegmentStartAudio = (segment: SegmentType): string => {
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
      return 'Night-end/Wake-up-everyone';
  }
  return '';
};

const getSegmentEndAudio = (
  segment: Exclude<SegmentType, 'HUNTER'>
): string | null => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-2';
    case 'LOVERS':
      return 'Lovers/Lover-3';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-2';
    case 'WITCH-HEAL':
      return null;
    case 'WITCH-POISON':
      return 'Witch/Witch-end';
    case 'DAY':
      return 'Day-vote/Vote-Death';
  }
  return null;
};
