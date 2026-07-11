import { describe, it, vi } from 'vitest';

import { GameSimulator } from '@/simulation/game-simulator';
import {
  assertCompleted,
  assertDeathAudioInvariants,
  assertOnlyKnownPlaceholders,
} from '@/simulation/audio-validators';

vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

/** Deterministic 32-bit PRNG so the random-games suite is reproducible. */
function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const GAMES = 40;

/**
 * Broad, reproducible coverage: runs many random games (half with a forced
 * hunter, lovers random / random-with-hunter) and asserts the audio
 * invariants hold for every one. A failure is a real, reproducible bug —
 * print the seed + role/lover layout to reproduce.
 */
describe('random game audio invariants', () => {
  it.each(
    Array.from({ length: GAMES }, (_, i) => {
      const withHunter = i % 2 === 0;
      const lovers = i % 3 === 0 ? 'random-with-hunter' : 'random';
      return {
        seed: 1000 + i,
        forceHunter: withHunter ? 'Player2' : null,
        lovers,
      };
    })
  )(
    'game $seed (forceHunter=$forceHunter, lovers=$lovers) satisfies the audio invariants',
    async ({ seed, forceHunter, lovers }) => {
      const sim = new GameSimulator({
        flush,
        rng: mulberry32(seed),
        forceHunterName: forceHunter,
        lovers: lovers as 'random' | 'random-with-hunter',
      });
      await sim.run();

      // On a failure, surface the reproducible layout before the assertion
      // message so the role/lover/death sequence is visible in CI output.
      if (sim.error) {
        const layout = sim.aliveSids();
        console.error('FAILED seed', seed, 'error', sim.error, 'alive', layout);
      }

      assertCompleted(sim);
      assertDeathAudioInvariants(sim);
      assertOnlyKnownPlaceholders(sim);
    }
  );
});
