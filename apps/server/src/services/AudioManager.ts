import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Effect } from 'effect';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';

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
          catch: (error) => new AudioPlaybackError({ file, error }),
        });

      return {
        playSegmentStart: (segment: SegmentType) =>
          Effect.gen(function* () {
            const audioFile = getSegmentStartAudio(segment);
            if (!audioFile) {
              return;
            }

            if (segment === 'LOVERS' || segment === 'DAY') {
              Effect.runFork(playAudio(audioFile));
              return;
            }

            yield* playAudio(audioFile);
          }),

        playSegmentEnd: (segment: SegmentType) =>
          Effect.gen(function* () {
            const audioFile = getSegmentEndAudio(segment);
            if (!audioFile) {
              return;
            }
            yield* playAudio(audioFile);
          }),

        playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
          playAudio(
            winner === 'werewolves'
              ? 'End-game/Werewolves-won'
              : 'End-game/Villagers-won'
          ),

        playSpecialAudio: (
          type: 'HUNTER_IS_LOVER' | 'PARTNER_IS_HUNTER' | 'LOVER_DEATH'
        ) =>
          Effect.gen(function* () {
            switch (type) {
              case 'HUNTER_IS_LOVER':
                yield* playAudio('Special-scenarios/hunter-is-lover');
                break;
              case 'PARTNER_IS_HUNTER':
                yield* playAudio('Special-death/Lover-Hunter');
                break;
              case 'LOVER_DEATH':
                yield* playAudio('Special-death/Lover-Death');
                break;
              default:
                break;
            }
          }),

        playDayVoteHunterHasPartner: Effect.gen(function* () {
          yield* playAudio('Special-death/Hunter-has-lover');
        }),

        playDayVoteLoversDeath: Effect.gen(function* () {
          yield* playAudio('Day-vote/Lover');
        }),
      };
    }),
    dependencies: [], // No dependencies, self-contained
  }
) {}

const getSegmentStartAudio = (segment: SegmentType): string | undefined => {
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
      return 'Hunter/Hunter';
    case 'DAY':
      return 'Wake-up-everyone';
    default:
      return;
  }
};

const getSegmentEndAudio = (segment: SegmentType): string | undefined => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-2';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-2';
    case 'WITCH-POISON':
      return 'Witch/Witch-end';
    case 'HUNTER':
      return 'Hunter-end';
    default:
      return;
  }
};
