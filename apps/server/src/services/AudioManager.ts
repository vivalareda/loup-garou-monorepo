import { existsSync } from 'node:fs';
import type { SegmentType } from '@repo/types';
import { Config, Context, Effect, Layer } from 'effect';
import sound from 'sound-play';
import { AudioPlaybackError } from './errors.js';

type AudioManagerSegment = Extract<
  SegmentType,
  'LOVERS' | 'WEREWOLF' | 'CUPID'
>;

const FILE_REGEX = /__\d\d$/;

const makeAudioManager = Effect.gen(function* () {
  const assetsPath = yield* Config.string('ASSETS_PATH').pipe(
    Config.withDefault('./assets')
  );

  let loverAudioRunning = false;

  const AUDIO_VARIANT_COUNT = 3;

  const resolveAudioId = (requestedId: string): string | null => {
    const requestedPath = `${assetsPath}/${requestedId}.mp3`;

    if (requestedId.match(FILE_REGEX)) {
      return existsSync(requestedPath) ? requestedId : null;
    }

    const variants: string[] = [];
    for (let i = 1; i <= AUDIO_VARIANT_COUNT; i++) {
      const suffix = String(i).padStart(2, '0');
      const variantId = `${requestedId}__${suffix}`;
      const variantPath = `${assetsPath}/${variantId}.mp3`;
      if (existsSync(variantPath)) {
        variants.push(variantId);
      }
    }

    if (variants.length > 0) {
      const idx = Math.floor(Math.random() * variants.length);
      return variants[idx] ?? null;
    }

    return existsSync(requestedPath) ? requestedId : null;
  };

  const playAudio = (file: string) =>
    Effect.tryPromise({
      try: async () => {
        const resolvedId = resolveAudioId(file);
        if (!resolvedId) {
          return;
        }

        const fullPath = `${assetsPath}/${resolvedId}.mp3`;
        await sound.play(fullPath);
      },
      catch: (error) => new AudioPlaybackError({ file, error }),
    });

  const getSegmentEndAudio = (segment: AudioManagerSegment): string => {
    switch (segment) {
      case 'CUPID':
        console.log('returning cupid end audio');
        return 'Cupidon/Cupidon-2';
      case 'WEREWOLF':
        console.log('returning werwolf end audio');
        return 'Werewolves/Werewolves-2';
      case 'LOVERS':
        return 'Lovers/Lover-3';
      default:
        throw new Error(`${segment satisfies never} end audio doesn't exist`);
    }
  };

  const getSegmentStartAudio = (segment: AudioManagerSegment): string => {
    switch (segment) {
      case 'CUPID':
        return 'Cupidon/Cupidon-1';
      case 'LOVERS':
        return 'Lovers/combined_lover';
      case 'WEREWOLF':
        return 'Werewolves/Werewolves-1';
      default:
        throw new Error(`${segment satisfies never} start audio doesn't exist`);
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
    segment: AudioManagerSegment
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
    segment: AudioManagerSegment
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
