import { Data } from 'effect';

export class HunterRevengeError extends Data.TaggedError(
  'HunterRevengeError'
) {}

export class HunterAlreadyFiredError extends Data.TaggedError(
  'HunterAlreadyFiredError'
)<{
  hunterId: string;
}> {}

export class NotHunterError extends Data.TaggedError('NotHunterError')<{
  playerId: string;
}> {}

export class HunterTargetSelfError extends Data.TaggedError(
  'HunterTargetSelfError'
)<{
  hunterId: string;
}> {}

export class HunterTargetDeadError extends Data.TaggedError(
  'HunterTargetDeadError'
)<{
  targetId: string;
}> {}
