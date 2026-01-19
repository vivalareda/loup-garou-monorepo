import { Data } from 'effect';

export class SocketError extends Data.TaggedError('SocketError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}
