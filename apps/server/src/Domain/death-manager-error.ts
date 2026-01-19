import { Data } from 'effect';

export class DeathManagerError extends Data.TaggedError('DeathManagerError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
