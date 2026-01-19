import type { Segment } from '@repo/types';
import { Context, Effect, Layer, Ref } from 'effect';
import { GameService } from '../core/game-effect';
import type { AudioError } from '../Domain/audio-error';
import { SegmentError } from '../Domain/SegmentError';
import { AudioManagerTag } from './audio-manager-effect';

export class SegmentsManagerService extends Context.Tag(
  'SegmentsManagerService'
)<
  SegmentsManagerService,
  {
    readonly initializeSegments: Effect.Effect<void, SegmentError>;
    readonly startGame: Effect.Effect<void, SegmentError | AudioError>;
    readonly playSegment: Effect.Effect<void, SegmentError | AudioError>;
    readonly finishSegment: Effect.Effect<void, SegmentError | AudioError>;
    readonly getCurrentSegmentType: Effect.Effect<string>;
    readonly checkPostDayVoteScenarios: Effect.Effect<boolean, SegmentError>;
  }
>() {}

export const SegmentsManagerLive = Layer.effect(
  SegmentsManagerService,
  Effect.gen(function* (_) {
    yield* _(GameService);
    const audioManager = yield* _(AudioManagerTag);

    const segmentsRef = yield* _(Ref.make<Segment[]>([]));
    const currentSegmentIndexRef = yield* _(Ref.make(0));

    const getSegments = Ref.get(segmentsRef);
    const getCurrentSegmentIndex = Ref.get(currentSegmentIndexRef);

    const isFirstNightSegment = (type: string) =>
      type === 'CUPID' || type === 'LOVERS';

    const initializeSegments = Effect.gen(function* ($) {
      const segments: Segment[] = [
        {
          type: 'CUPID',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: false,
        },
        {
          type: 'LOVERS',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: false,
        },
        {
          type: 'WEREWOLF',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: false,
        },
        {
          type: 'WITCH-HEAL',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: true,
        },
        {
          type: 'WITCH-POISON',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: true,
        },
        {
          type: 'DAY',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: false,
        },
        {
          type: 'HUNTER',
          action: () => {
            /* Placeholder for GameActions */
          },
          skip: true,
        },
      ];
      yield* $(Ref.set(segmentsRef, segments));
    });

    const findValidSegment = Effect.gen(function* ($) {
      const segments = yield* $(getSegments);
      let currentIndex = yield* $(getCurrentSegmentIndex);

      let attempts = 0;
      while (attempts < segments.length) {
        if (currentIndex >= segments.length) {
          currentIndex = 0;
        }
        if (!segments[currentIndex].skip) {
          break;
        }
        currentIndex++;
        attempts++;
      }

      yield* $(Ref.set(currentSegmentIndexRef, currentIndex));
    });

    const markFirstNightSegment = (segment: Segment) => {
      if (isFirstNightSegment(segment.type)) {
        segment.skip = true;
      }
    };

    const playSegment = Effect.gen(function* ($) {
      const segments = yield* $(getSegments);
      const index = yield* $(getCurrentSegmentIndex);
      const segment = segments[index];

      if (!segment) {
        yield* $(
          Effect.fail(new SegmentError({ message: 'No segment found' }))
        );
        return;
      }

      console.log(`[SEGMENT] Playing segment: ${segment.type}`);

      yield* $(audioManager.playSegmentAudio(segment.type, true));
    });

    const finishSegment = Effect.gen(function* ($) {
      const segments = yield* $(getSegments);
      const index = yield* $(getCurrentSegmentIndex);
      const segment = segments[index];

      if (!segment) {
        yield* $(
          Effect.fail(new SegmentError({ message: 'No segment found' }))
        );
        return;
      }

      yield* $(audioManager.playSegmentAudio(segment.type, false));
      markFirstNightSegment(segment);

      yield* $(Ref.update(currentSegmentIndexRef, (i) => i + 1));
      yield* $(findValidSegment);
      yield* $(playSegment);
    });

    const startGame = Effect.gen(function* ($) {
      yield* $(playSegment);
    });

    const getCurrentSegmentType = Effect.gen(function* ($) {
      const segments = yield* $(getSegments);
      const index = yield* $(getCurrentSegmentIndex);
      return segments[index]?.type ?? '';
    });

    const checkPostDayVoteScenarios = Effect.succeed(false);

    return {
      initializeSegments,
      startGame,
      playSegment,
      finishSegment,
      getCurrentSegmentType,
      checkPostDayVoteScenarios,
    };
  })
);
