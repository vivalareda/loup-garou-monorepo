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

      let loverAudioRunning = false;
      let witchHealAudioFile = 'skip';
      let witchPoisonAudioFile = 'Witch/Witch-end';

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
          case 'WITCH_HEAL':
            return witchHealAudioFile;
          case 'WITCH_POISON':
            return witchPoisonAudioFile;
          default:
            return 'to implement';
        }
      };

      const getSegmentStartAudio = (segment: SegmentType): string => {
        switch (segment) {
          case 'CUPID':
            return 'Cupidon/Cupidon-1';
          case 'LOVERS':
            return 'Lovers/combined_lover';
          case 'WEREWOLF':
            return 'Werewolves/Werewolves-1';
          case 'WITCH_HEAL':
            return 'Witch/heeling-audio';
          case 'WITCH_POISON':
            return 'Witch/Witch-poison';
          case 'DAY_VOTE':
            return 'Day-vote/Vote-Start';
          case 'HUNTER':
            return 'Hunter/Hunter-wake-up';
          default:
            return 'problem';
        }
      };

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
        yield* Effect.log(`playing audio ${audioFile} for segment ${segment}`);

        if (segment === 'WITCH_HEAL') {
          yield* playAudio('Witch/wake-up-witch');
        }

        segment === 'LOVERS'
          ? yield* playLoversAudio(audioFile)
          : yield* playAudio(audioFile);
      });

      const playSegmentEnd = Effect.fn('playSegmentEnd')(function* (
        segment: SegmentType
      ) {
        const audioFile = getSegmentEndAudio(segment);
        yield* Effect.log(`end audio: ${audioFile}`);

        if (audioFile !== 'skip') {
          yield* playAudio(audioFile);
        }
      });

      // const playWitchAudio = Effect.fn('playWitchAudio')(function* (context: {
      //   playHeal: boolean;
      //   playPoison: boolean;
      // }) {
      //   yield* playAudio('Witch/wake-up-witch');
      //
      //   if (context.playHeal) {
      //     yield* playAudio('Witch/heeling-audio');
      //     return;
      //   }
      //
      //   if (context.playPoison) {
      //     yield* playAudio('Witch/Witch-poison');
      //     return;
      //   }
      //
      //   yield* playAudio('Witch/Witch-end');
      // });

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
