import { Data } from 'effect';

export class SegmentError extends Data.TaggedError('SegmentError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
