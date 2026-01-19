import { Data } from 'effect';

export class ActionError extends Data.TaggedError('ActionError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
