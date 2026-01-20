import { Data } from 'effect';

export class InvalidVoterError extends Data.TaggedError('InvalidVoterError')<{
  socketId: string;
  reason: string;
}> {}

export class InvalidVoteTargetError extends Data.TaggedError(
  'InvalidVoteTargetError'
)<{
  targetId: string;
  reason: string;
}> {}

export class VoteProcessingError extends Data.TaggedError(
  'VoteProcessingError'
)<{
  message: string;
  cause?: unknown;
}> {}
