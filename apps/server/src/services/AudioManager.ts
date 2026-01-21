import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Effect, Layer } from 'effect';
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

            if (segment === 'LOVERS' || segment === 'DAY_VOTE') {
              Effect.runFork(playAudio(audioFile));
              return;
            }

            yield* playAudio(audioFile);
          }),

        playSegmentEnd: (segment: SegmentType) =>
          Effect.gen(function* () {
            switch (segment) {
              case 'CUPID':
                return yield* playAudio('Cupidon/Cupidon-2');
              case 'WEREWOLF':
                return yield* playAudio('Werewolves/Werewolves-2');
              case 'DAY_VOTE':
                return yield* playAudio('Day-vote/Vote-Death');
              case 'HUNTER':
                return; // No end audio for hunter
            }
          }),

        playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
          playAudio(
            winner === 'werewolves'
              ? 'End-game/Werewolves-won'
              : 'End-game/Villagers-won'
          ),

        playIntro: () => playAudio('Intro'),
      };
    }),
    dependencies: [], // No dependencies, self-contained
  }
) {
  static Test = Layer.succeed(
    this,
    new AudioManager({
      playIntro: () => Effect.void,
      playWinnerAudio: () => Effect.void,
      playSegmentEnd: () => Effect.void,
      playSegmentStart: () => Effect.void,
    })
  );
}

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
    default:
      return 'problem';
  }
};
