import { Data } from 'effect';

export class GameError extends Data.TaggedError('GameError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
