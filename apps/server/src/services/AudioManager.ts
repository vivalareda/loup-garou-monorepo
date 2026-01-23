import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Effect, Layer } from 'effect';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';

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
    case 'DAY_VOTE':
      return 'Day-vote/Vote-Start';
    case 'HUNTER':
      return 'Hunter/Hunter-wake-up';
    default:
      return 'problem';
  }
};

const getSegmentEndAudio = (segment: SegmentType): string | null => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-2';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-2';
    case 'DAY_VOTE':
      return 'Day-vote/Vote-Death';
    case 'HUNTER':
    case 'LOVERS':
    case 'WITCH-HEAL':
    case 'WITCH-POISON':
      return null;
    default:
      return null;
  }
};

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

      const playSegmentStart = Effect.fn('playSegmentStart')(function* (
        segment: SegmentType
      ) {
        const audioFile = getSegmentStartAudio(segment);
        yield* playAudio(audioFile);
      });

      const playSegmentEnd = Effect.fn('playSegmentEnd')(function* (
        segment: SegmentType
      ) {
        const audioFile = getSegmentEndAudio(segment);
        if (audioFile) {
          yield* playAudio(audioFile);
        }
      });

      const playWinnerAudio = Effect.fn('playWinnerAudio')(function* (
        winner: 'werewolves' | 'villagers'
      ) {
        yield* playAudio(
          winner === 'werewolves'
            ? 'End-game/Werewolves-won'
            : 'End-game/Villagers-won'
        );
      });

      const playIntro = Effect.gen(function* () {
        yield* playAudio('Intro');
      });

      return {
        playSegmentStart,
        playSegmentEnd,
        playWinnerAudio,
        playIntro,
      };
    }),
  }
) {
  static Test = Layer.succeed(
    this,
    new AudioManager({
      playIntro: Effect.void,
      playWinnerAudio: () => Effect.void,
      playSegmentEnd: () => Effect.void,
      playSegmentStart: () => Effect.void,
    })
  );
}
