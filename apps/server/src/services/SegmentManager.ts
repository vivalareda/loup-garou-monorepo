import type { SegmentType } from '@repo/types';
import { Effect } from 'effect';

export class InvalidSegmentIndex extends Error {
  readonly _tag = 'InvalidSegmentIndex';
  constructor(readonly index: number, readonly maxIndex: number) {
    super(`Invalid segment index: ${index} (max: ${maxIndex})`);
  }
}

export class SegmentNotFound extends Error {
  readonly _tag = 'SegmentNotFound';
  constructor(readonly type: SegmentType) {
    super(`Segment not found: ${type}`);
  }
}

type SegmentState = { type: SegmentType; skip: boolean };

export class SegmentManager extends Effect.Service<SegmentManager>()(
  '@app/SegmentManager',
  {
    effect: Effect.gen(function* () {
      const segments: SegmentState[] = [
        { type: 'CUPID', skip: false },
        { type: 'LOVERS', skip: false },
        { type: 'WEREWOLF', skip: false },
        { type: 'WITCH-HEAL', skip: true },
        { type: 'WITCH-POISON', skip: true },
        { type: 'DAY', skip: false },
        { type: 'HUNTER', skip: true },
      ];

      let currentIndex = 0;

      const getAllSegments = Effect.sync(() => {
        return Array.from(segments);
      });

      const getSegments = Effect.sync(() => {
        return segments.filter((s) => !s.skip);
      });

      const getCurrentSegment = Effect.gen(function* () {
        if (currentIndex >= segments.length) {
          return yield* Effect.fail(
            new InvalidSegmentIndex(currentIndex, segments.length - 1)
          );
        }

        return segments[currentIndex];
      });

      const getCurrentSegmentType = Effect.gen(function* () {
        const currentSegment = yield* getCurrentSegment;
        return currentSegment.type;
      });

      const getSegmentByType = (type: SegmentType) =>
        Effect.gen(function* () {
          const segment = segments.find((s) => s.type === type);

          if (!segment) {
            return yield* Effect.fail(new SegmentNotFound(type));
          }

          return segment;
        });

      const findValidSegment = Effect.sync(() => {
        while (currentIndex < segments.length && segments[currentIndex].skip) {
          currentIndex++;
        }

        if (currentIndex >= segments.length) {
          currentIndex = 0;

          while (
            currentIndex < segments.length &&
            segments[currentIndex].skip
          ) {
            currentIndex++;
          }
        }

        return segments[currentIndex];
      });

      const nextSegment = Effect.gen(function* () {
        currentIndex++;

        if (currentIndex >= segments.length) {
          currentIndex = 0;
        }

        yield* findValidSegment;

        return yield* getCurrentSegment;
      });

      const setSegmentSkip = (type: SegmentType, skip: boolean) =>
        Effect.sync(() => {
          const index = segments.findIndex((s) => s.type === type);
          if (index !== -1) {
            segments[index].skip = skip;
          }
        });

      const markFirstNightSegmentsAsSkipped = Effect.sync(() => {
        const firstNightSegments = ['CUPID', 'LOVERS'];

        for (const segment of segments) {
          if (firstNightSegments.includes(segment.type)) {
            segment.skip = true;
          }
        }
      });

      const markWitchSegmentsAsSkipped = Effect.sync(() => {
        for (const segment of segments) {
          if (segment.type === 'WITCH-HEAL' || segment.type === 'WITCH-POISON') {
            segment.skip = true;
          }
        }
      });

      const isFirstNightSegment = (type: string) =>
        Effect.sync(() => {
          return type === 'CUPID' || type === 'LOVERS';
        });

      const reset = Effect.sync(() => {
        currentIndex = 0;
        segments[0].skip = false;
        segments[1].skip = false;
        segments[2].skip = false;
        segments[3].skip = true;
        segments[4].skip = true;
        segments[5].skip = false;
        segments[6].skip = true;
      });

      const setSegmentIndex = (index: number) =>
        Effect.gen(function* () {
          if (index < 0 || index >= segments.length) {
            return yield* Effect.fail(
              new InvalidSegmentIndex(index, segments.length - 1)
            );
          }
          currentIndex = index;
        });

      const getSegmentIndex = (type: SegmentType) =>
        Effect.sync(() => {
          return segments.findIndex((s) => s.type === type);
        });

      return {
        getAllSegments,
        getSegments,
        getCurrentSegment,
        getCurrentSegmentType,
        getSegmentByType,
        findValidSegment,
        nextSegment,
        setSegmentSkip,
        markFirstNightSegmentsAsSkipped,
        markWitchSegmentsAsSkipped,
        isFirstNightSegment,
        reset,
        setSegmentIndex,
        getSegmentIndex,
      };
    }).pipe(Effect.annotateLogs('service', 'SegmentManager')),
    dependencies: [],
  }
) {}
