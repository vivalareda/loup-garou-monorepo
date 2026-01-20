import { Data, Effect } from 'effect';

export class WitchHasNoPotionError extends Data.TaggedError(
  'WitchHasNoPotionError'
)<{
  potionType: 'HEAL' | 'POISON';
}> {}

export class WitchAlreadyUsedPotionError extends Data.TaggedError(
  'WitchAlreadyUsedPotionError'
)<{
  potionType: 'HEAL' | 'POISON';
}> {}

export class InvalidWitchTargetError extends Data.TaggedError(
  'InvalidWitchTargetError'
)<{
  reason: string;
}> {}
