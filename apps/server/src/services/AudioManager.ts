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

const getSegmentEndAudio = (segment: SegmentType): string => {
  switch (segment) {
    case 'CUPID':
      return 'Cupidon/Cupidon-2';
    case 'WEREWOLF':
      return 'Werewolves/Werewolves-2';
    case 'DAY_VOTE':
      return 'Day-vote/Vote-Death';
    case 'HUNTER':
      return 'to implement';
    case 'LOVERS':
      return 'Lovers/Lover-3';
    case 'WITCH-HEAL':
      return 'to implement';
    case 'WITCH-POISON':
      return 'to implement';
    default:
      return 'to implement';
  }
};

export class AudioManager extends Effect.Service<AudioManager>()(
  '@app/AudioManager',
  {
    effect: Effect.gen(function* () {
      const assetsPath = yield* Config.string('ASSETS_PATH').pipe(
        Config.withDefault('./assets')
      );

      let loverAudioRunning = false;

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

      const playLoversAudio = Effect.fn('playLoversAudio')(function* (
        file: string
      ) {
        const LOVERS_AUDIO_LENGTH = 13_000;
        yield* Effect.sync(() => setLoverAudioRunning(true));

        yield* playAudio(file).pipe(Effect.forkDaemon);

        yield* Effect.sync(() => {
          setLoverAudioRunning(false);
        }).pipe(Effect.delay(LOVERS_AUDIO_LENGTH), Effect.forkDaemon);
      });

      const setLoverAudioRunning = (value: boolean) => {
        loverAudioRunning = value;
      };

      const isLoverAudioRunning = () => loverAudioRunning;

      const playSegmentStart = Effect.fn('playSegmentStart')(function* (
        segment: SegmentType
      ) {
        const audioFile = getSegmentStartAudio(segment);
        segment === 'LOVERS'
          ? yield* playLoversAudio(audioFile)
          : yield* playAudio(audioFile);
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

      const playIntro = playAudio('intro');

      return {
        playSegmentStart,
        playSegmentEnd,
        playWinnerAudio,
        isLoverAudioRunning,
        playIntro,
      };
    }),
  }
) {
  static Test = Layer.succeed(
    this,
    new AudioManager({
      playIntro: Effect.void,
      isLoverAudioRunning: () => false,
      playWinnerAudio: () => Effect.void,
      playSegmentEnd: () => Effect.void,
      playSegmentStart: () => Effect.void,
    })
  );
}
