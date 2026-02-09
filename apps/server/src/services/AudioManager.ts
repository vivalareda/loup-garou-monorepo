import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Context, Effect, Layer } from 'effect';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';

const makeAudioManager = Effect.gen(function* () {
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

  const getSegmentEndAudio = (
    segment: Exclude<SegmentType, 'WITCH'>
  ): string => {
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
      case 'WITCH':
        return 'skip'; // Witch handles its own audio internally
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

  const playDeathAnnoucementAudio = Effect.fn('playDeathAnnoucementAudio')(
    function* (deathCount: number) {
      yield* playAudio('Night-end/Wake-up-everyone');

      if (deathCount === 0) {
        yield* playAudio('Night-end/No-deaths');
      } else {
        yield* playAudio('Night-end/Deaths');
      }
    }
  );

  const setLoverAudioRunning = (value: boolean) => {
    loverAudioRunning = value;
  };

  const isLoverAudioRunning = () => loverAudioRunning;

  const playSegmentStart = Effect.fn('playSegmentStart')(function* (
    segment: SegmentType
  ) {
    const audioFile = getSegmentStartAudio(segment);
    yield* Effect.log(`playing audio ${audioFile} for segment ${segment}`);

    if (audioFile !== 'skip') {
      segment === 'LOVERS'
        ? yield* playLoversAudio(audioFile)
        : yield* playAudio(audioFile);
    }
  });

  const playSegmentEnd = Effect.fn('playSegmentEnd')(function* (
    segment: Exclude<SegmentType, 'WITCH'>
  ) {
    const audioFile = getSegmentEndAudio(segment);
    yield* Effect.log(`end audio: ${audioFile}`);

    if (audioFile !== 'skip') {
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
    playAudio,
    playSegmentStart,
    playSegmentEnd,
    playWinnerAudio,
    isLoverAudioRunning,
    playDeathAnnoucementAudio,
    playIntro,
  };
});

type AudioManagerService = typeof makeAudioManager extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class AudioManager extends Context.Tag('@app/AudioManager')<
  AudioManager,
  AudioManagerService
>() {
  static readonly DefaultWithoutDependencies = Layer.effect(
    this,
    makeAudioManager
  );
  static readonly Default = this.DefaultWithoutDependencies;
  static Test = Layer.succeed(this, {
    playAudio: () => Effect.void,
    playIntro: Effect.void,
    isLoverAudioRunning: () => false,
    playDeathAnnoucementAudio: () => Effect.void,
    playWinnerAudio: () => Effect.void,
    playSegmentEnd: () => Effect.void,
    playSegmentStart: () => Effect.void,
  });
}
