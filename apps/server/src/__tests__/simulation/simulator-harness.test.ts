import { describe, expect, it } from 'vitest';

import { GameSimulator } from '@/simulation/game-simulator';
import {
  assertCompleted,
  assertDeathAudioInvariants,
  assertOnlyKnownPlaceholders,
} from '@/simulation/audio-validators';

/** Deterministic 32-bit PRNG so the harness scenarios are reproducible. */
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

/** Fast flush: drains microtasks + fires 0ms timers without the 1ms clamp. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

async function runGame(
  seed: number,
  overrides: ConstructorParameters<typeof GameSimulator>[0] = {}
) {
  const sim = new GameSimulator({
    flush,
    rng: mulberry32(seed),
    ...overrides,
  });

  await sim.run();

  return sim;
}

describe('GameSimulator harness', () => {
  it('completes a random 6-player game to a winner with winner audio', async () => {
    // The assert* helpers assert through expect
    expect.hasAssertions();

    const sim = await runGame(1);
    assertCompleted(sim);
    assertOnlyKnownPlaceholders(sim);
  });

  it('exercises the hunter-death and lover-death audio paths across games', async () => {
    // Force a hunter who is also a lover so the hunter-pick + lover-grief
    // branches are reached. Run a small reproducible batch and assert the
    // conditional invariants for every game, plus that the batch as a whole
    // actually saw a hunter die and a lover die (so the audio paths ran).
    let sawHunterDeath = false;
    let sawLoverDeath = false;

    for (let i = 0; i < 16; i++) {
      const sim = await runGame(100 + i, {
        forceHunterName: 'Player2',
        lovers: 'random-with-hunter',
      });

      assertCompleted(sim);
      assertDeathAudioInvariants(sim);
      assertOnlyKnownPlaceholders(sim);

      // assertDeathAudioInvariants checked each death's cue above; this
      // only records that the batch reached both paths
      sawHunterDeath ||= sim.deathLog.some(
        (sid) => sim.roleOf(sid) === 'HUNTER'
      );
      sawLoverDeath ||= sim.deathLog.some((sid) => sim.isLover(sid));
    }

    expect(sawHunterDeath).toBe(true);
    expect(sawLoverDeath).toBe(true);
  });

  it('completes multi-night games after a werewolf is voted out (deadlock fix)', async () => {
    // Pre-fix, a werewolf that died left a stale `werewolfVotes` entry; the
    // next night `hasAllWerewolvesAgreed()` returned false forever and the
    // game deadlocked. Post-fix the votes clear each night, so a multi-night
    // game where a werewolf dies still completes.
    let sawMultiNightWerewolfDeath = false;

    for (let i = 0; i < 16; i++) {
      const sim = await runGame(500 + i);
      assertCompleted(sim);
      assertDeathAudioInvariants(sim);
      assertOnlyKnownPlaceholders(sim);

      const werewolfDied = sim.deathLog.some(
        (sid) => sim.roleOf(sid) === 'WEREWOLF'
      );

      if (werewolfDied && sim.rounds > 1) {
        sawMultiNightWerewolfDeath = true;
      }
    }

    expect(sawMultiNightWerewolfDeath).toBe(true);
  });
});
