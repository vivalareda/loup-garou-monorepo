import { Effect } from 'effect';
import { StaleGame } from '@/segments/game-generation';
import type { SegmentsManager } from '@/segments/segments-manager';

/**
 * Awaits narration inside a resolution. `AudioManager.playAudio` rejects
 * with `StaleGame` when the game ends mid-clip; that becomes a typed
 * failure (so `runResolution` drops the rest of the program), any other
 * rejection stays a defect.
 */
export function narration(
  play: () => Promise<void>
): Effect.Effect<void, StaleGame> {
  const settled = () =>
    play().then(
      () => null,
      (error: unknown) => {
        if (error instanceof StaleGame) {
          return error;
        }
        throw error;
      }
    );
  return Effect.flatMap(Effect.promise(settled), (stale) =>
    stale ? Effect.fail(stale) : Effect.void
  );
}

/**
 * Awaits `run` (a hunter pick), then stops the program with `StaleGame`
 * if the game it belongs to ended meanwhile, so nothing after the await
 * touches the next game.
 */
export function awaitInGame<A>(
  segmentsManager: SegmentsManager,
  generation: number,
  run: Effect.Effect<A, StaleGame>
): Effect.Effect<A, StaleGame> {
  return Effect.filterOrFail(
    run,
    () => segmentsManager.isCurrentGeneration(generation),
    () => new StaleGame()
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
