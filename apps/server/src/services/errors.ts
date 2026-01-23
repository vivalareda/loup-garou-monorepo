/** biome-ignore-all lint/complexity/noBannedTypes: <idiomatic effect> */
import type { Role } from '@repo/types';
import { Data } from 'effect';

export class NameExistsError extends Data.TaggedError('NameExists')<{}> {}
export class LobbyFullError extends Data.TaggedError('LobbyFull')<{}> {}

export class PlayerNotFoundError extends Data.TaggedError(
  'PlayerNotFoundError'
)<{
  socketId: string;
}> {}

export class SpecialPlayerNotFoundError extends Data.TaggedError(
  'PlayerNotFoundError'
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
