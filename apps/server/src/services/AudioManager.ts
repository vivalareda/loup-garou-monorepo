import { Effect, Config } from 'effect';
import { existsSync } from 'node:fs';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';
import { SegmentType } from '@repo/types';

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

            if (segment === 'LOVERS' || segment === 'DAY') {
              Effect.runFork(playAudio(audioFile));
              return;
            }

            yield* playAudio(audioFile);
          }),

        playSegmentEnd: (segment: SegmentType) =>
          Effect.gen(function* () {
            const audioFile = getSegmentEndAudio(segment);
            if (!audioFile) return;
            yield* playAudio(audioFile);
          }),

        playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
          playAudio(
            winner === 'werewolves'
              ? 'End-game/Werewolves-won'
              : 'End-game/Villagers-won'
          ),
      };
    }),
    dependencies: [], // No dependencies, self-contained
  }
) { }

const getSegmentStartAudio = (segment: SegmentType): string => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-1';
    case 'LOVERS_REVEAL':
      return 'Lovers/combined_lover';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-1';
    case 'WITCH':
      return 'Witch/Witch-wake-up';
    case 'DAY_VOTE':
      return 'Day-vote/Vote-Start';
  }
};
