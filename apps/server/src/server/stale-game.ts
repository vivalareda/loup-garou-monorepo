import { Data, Effect } from 'effect';
import type { SegmentsManager } from '@/segments/segments-manager';

/** The game a resolution was started for has finished or been reset. */
export class StaleGame extends Data.TaggedError('StaleGame') {}

/**
 * Awaits `run` (narration, a hunter pick), then stops the program with
 * `StaleGame` if the game it belongs to ended meanwhile, so nothing after
 * the await touches the next game.
 */
export function awaitInGame<A>(
  segmentsManager: SegmentsManager,
  generation: number,
  run: Effect.Effect<A>
): Effect.Effect<A, StaleGame> {
  return Effect.flatMap(run, (value) =>
    segmentsManager.isCurrentGeneration(generation)
      ? Effect.succeed(value)
      : Effect.fail(new StaleGame())
  );
}

/** Runs a resolution program; a stale game just ends it quietly. */
export function runResolution(program: Effect.Effect<void, StaleGame>) {
  return Effect.runPromise(
    Effect.catchTag(program, 'StaleGame', () =>
      Effect.log('Resolution dropped: its game is over')
    )
  );
}
