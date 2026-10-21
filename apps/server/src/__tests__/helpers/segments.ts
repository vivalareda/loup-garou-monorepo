import { vi } from 'vitest';
import type { Game } from '@/core/game';
import type { SegmentsManager } from '@/segments/segments-manager';

/**
 * Starts the game and parks it on the segment `type` without playing any
 * segment, so a test can drive that segment's handlers directly. An
 * unknown `type` leaves the manager on its first segment.
 */
export function enterSegment(segmentsManager: SegmentsManager, type: string) {
  // startGame plays the first segment: swallow that one call only, so the
  // test can still play the segment it parks on
  if (!segmentsManager.hasStarted()) {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValueOnce(undefined);
    segmentsManager.startGame();
  }

  const index = segmentsManager.segments.findIndex(
    (segment) => segment.type === type
  );

  if (index !== -1) {
    segmentsManager.currentSegment = index;
  }
}

/**
 * Ends the game through the real victory path (winner alerts, FINISHED
 * state, cleared clocks), as if `winner` had just won.
 */
export function finishGame(
  segmentsManager: SegmentsManager,
  game: Game,
  winner: 'villagers' | 'werewolves'
) {
  vi.spyOn(game, 'checkIfWinner').mockReturnValueOnce(winner);
  segmentsManager.isGameOver();
}
