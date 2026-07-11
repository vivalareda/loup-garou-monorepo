import { expect } from 'vitest';

import type { GameSimulator } from '@/simulation/game-simulator';

/**
 * Audio files that play as part of a lover grief / lover-death cascade,
 * gathered from `audio-manager.ts` and `special-scenarios.ts`. When a lover
 * dies (night kill, poison, or day vote), at least one of these must appear
 * in the recorded audio log. The hunter-is-lover combo cues belong to BOTH
 * sets because that branch plays both the hunter-pick and the lover-grief
 * audio.
 */
export const LOVER_CUES = [
  'Special-death/pre-day-vote-lover-2',
  'Day-vote/Lover',
  'Pre-day-vote/Second-lover-hunter',
  'Special-scenarios/hunter-is-lover',
  'Night-end/hunter-killed-lover',
  'Special-death/pre-day-vote-hunter-has-lover',
] as const;

/**
 * Audio files that play when a hunter dies and is asked for a revenge pick
 * (night kill, poison, or day vote), plus the hunter-is-lover combo cues.
 */
export const HUNTER_CUES = [
  'Hunter/Hunter',
  'Hunter/Hunter-start-vote',
  'Day-vote/Hunter',
  'Pre-day-vote/Second-lover-hunter',
  'Special-scenarios/hunter-is-lover',
  'Night-end/hunter-killed-lover',
  'Special-death/pre-day-vote-hunter-has-lover',
] as const;

export const WINNER_CUES = [
  'End-game/Villagers-won',
  'End-game/Werewolves-won',
] as const;

/** Sentinel returned by `getSegmentEndAudio('WITCH-HEAL')` — a known gap. */
export const PLACEHOLDER_SENTINEL = 'not implemented yet';

function intersects(log: string[], cues: readonly string[]) {
  return cues.some((cue) => log.includes(cue));
}

/**
 * The game reached a real terminal state: a winner is set, no error was
 * thrown, and the winner audio played.
 */
export function assertCompleted(sim: GameSimulator) {
  expect(sim.error).toBeNull();
  expect(sim.winner === 'villagers' || sim.winner === 'werewolves').toBe(true);
  expect(intersects(sim.audioLog, WINNER_CUES)).toBe(true);
}

/**
 * Death-audio invariants:
 *  - if any dead player was a lover, a lover-grief cue played;
 *  - if any dead player was a hunter, a hunter-pick cue played;
 *  - if `hunter:pick-required` was emitted, a hunter cue played (the emit
 *    is the strongest signal — the game actually asked for a revenge pick).
 */
export function assertDeathAudioInvariants(sim: GameSimulator) {
  const loverDied = sim.deathLog.some((sid) => sim.isLover(sid));
  if (loverDied) {
    expect(intersects(sim.audioLog, LOVER_CUES)).toBe(true);
  }

  const hunterDied = sim.deathLog.some(
    (sid) => sim.roleOf(sid) === 'HUNTER'
  );
  if (hunterDied) {
    expect(intersects(sim.audioLog, HUNTER_CUES)).toBe(true);
  }

  if (sim.io.emitted('hunter:pick-required')) {
    expect(intersects(sim.audioLog, HUNTER_CUES)).toBe(true);
  }
}

/**
 * Returns every placeholder sentinel in the audio log. Today the only one is
 * `getSegmentEndAudio('WITCH-HEAL')` → `'not implemented yet'`, which plays
 * every night the witch-heal segment runs. The companion assertion
 * `assertOnlyKnownPlaceholders` fails if any OTHER placeholder appears (e.g.
 * a future HUNTER segment start leaking its placeholder), so this stays a
 * useful guard as the game grows.
 */
export function placeholderAudio(sim: GameSimulator): string[] {
  return [...new Set(sim.audioLog.filter((f) => f.includes(PLACEHOLDER_SENTINEL)))];
}

export function assertOnlyKnownPlaceholders(sim: GameSimulator) {
  const placeholders = placeholderAudio(sim);
  for (const file of placeholders) {
    expect(file).toBe(PLACEHOLDER_SENTINEL);
  }
}
