/** biome-ignore-all lint/complexity/noBannedTypes: <idiomatic effect> */
import type { Role } from '@repo/types';
import { Data } from 'effect';

export class NameExistsError extends Data.TaggedError('NameExists')<{}> {}
export class LobbyFullError extends Data.TaggedError('LobbyFull')<{}> {}

export class PlayerNotFoundError extends Data.TaggedError(
  'PlayerNotFoundError'
)<{
  socketId: string;
  message?: string;
}> {}

export class PlayerNotAliveError extends Data.TaggedError(
  'PlayerNotAliveError'
)<{
  socketId: string;
  message?: string;
}> {}

export class SheriffPlayerNotFoundError extends Data.TaggedError(
  'SheriffPlayerNotFoundError'
)<{}> {}

export class SheriffPlayerNotSetError extends Data.TaggedError(
  'SheriffPlayerNotSetError'
)<{}> {}

export class SpecialPlayerNotFoundError extends Data.TaggedError(
  'SpecialPlayerNotFoundError'
)<{
  role: Role;
}> {}

export class AudioPlaybackError extends Data.TaggedError('AudioPlaybackError')<{
  file: string;
  error: unknown;
}> {}

export class SegmentNotFoundError extends Data.TaggedError(
  'SegmentNotFoundError'
)<{
  segment: string;
}> {}

export class LoversNullError extends Data.TaggedError('LoversNullError')<{}> {}
export class PlayerNotWerewolfError extends Data.TaggedError(
  'PlayerNotWerewolfError'
)<{
  socketId: string;
}> {}
export class VictimNotFound extends Data.TaggedError('VictimNotFound')<{
  reason: string;
}> {}
export class NotEnoughPlayersError extends Data.TaggedError(
  'NotEnoughPlayersError'
)<{}> {}
