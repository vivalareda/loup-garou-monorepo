import { Schema } from '@effect/schema';
import { Data } from 'effect';

// Branded type for PlayerId
export const PlayerId = Schema.String.pipe(Schema.brand('PlayerId'));
export type PlayerId = Schema.Schema.Type<typeof PlayerId>;

// Player Schema
export class Player extends Schema.Class<Player>('Player')({
  id: PlayerId,
  name: Schema.String,
}) {}

// Domain Errors
export class PlayerNotFound extends Data.TaggedError('PlayerNotFound')<{
  id: PlayerId;
}> {}

export class PlayerAlreadyExists extends Data.TaggedError(
  'PlayerAlreadyExists'
)<{
  id: PlayerId;
}> {}
