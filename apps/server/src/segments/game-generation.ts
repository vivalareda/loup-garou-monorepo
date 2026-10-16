import { Data } from 'effect';

/** Work that belonged to a game which has since finished or been reset. */
export class StaleGame extends Data.TaggedError('StaleGame') {}

/** Drops a `StaleGame` rejection; anything else is rethrown. */
export function ignoreStaleGame(error: unknown) {
  if (!(error instanceof StaleGame)) {
    throw error;
  }
}

/**
 * Which game is current. `SegmentsManager` bumps it when a game finishes
 * or is reset; work that awaits (narration, a hunter pick) captures it
 * first and gives up if it changed, and `onBump` listeners cancel what
 * is still pending (a hunter pick and its timeout).
 */
export class GameGeneration {
  private value = 0;
  private readonly listeners: (() => void)[] = [];

  current() {
    return this.value;
  }

  isCurrent(generation: number) {
    return generation === this.value;
  }

  bump() {
    this.value++;
    for (const listener of this.listeners) {
      listener();
    }
  }

  onBump(listener: () => void) {
    this.listeners.push(listener);
  }
}
