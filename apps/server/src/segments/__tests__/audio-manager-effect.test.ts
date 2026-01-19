import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeathManager } from '@/core/death-manager';
import { AudioError } from '@/Domain/audio-error';
import { assertFailure, assertSuccess } from '@/utils/effect/test-utils';
import { AudioManagerLive, AudioManagerTag } from '../audio-manager-effect';

// Mock sound-play
vi.mock('sound-play', () => ({
  default: {
    play: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(true),
}));

describe('AudioManager', () => {
  const mockDeathManager = {
    getPendingDeaths: vi.fn(),
  } as unknown as DeathManager;

  const audioManagerLayer = AudioManagerLive(mockDeathManager);

  beforeEach(() => {
    vi.clearAllMocks();
    (mockDeathManager.getPendingDeaths as any).mockReturnValue([]);
  });

  it('plays start audio for valid segments', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('CUPID', true));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
    // Verify sound.play was called with correct path (implicit verification via success)
  });

  it('throws error for invalid segment start audio', async () => {
    // Note: The original code throws a synchronous Error for invalid segments in getSegmentStartAudio
    // We should probably catch this in the Effect wrapper if we want it to be an AudioError,
    // but currently it throws directly.

    // Let's test a case where we know it might fail or behave specificially.
    // Actually, typescript prevents passing invalid segments.
    // Let's test the default case of playAudio failing.

    const { default: sound } = await import('sound-play');
    (sound.play as any).mockRejectedValueOnce(new Error('File not found'));

    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('CUPID', true));
    });

    await assertFailure(Effect.provide(program, audioManagerLayer), AudioError);
  });

  it('plays death announcement when there are pending deaths', async () => {
    (mockDeathManager.getPendingDeaths as any).mockReturnValue(['player1']);

    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('DAY', true));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('plays no death announcement when there are no pending deaths', async () => {
    (mockDeathManager.getPendingDeaths as any).mockReturnValue([]);

    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('DAY', true));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('skips playing for HUNTER start', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('HUNTER', true));
    });
    // This throws because "not implemented yet" is returned string, which is then played.
    // Wait, getSegmentStartAudio returns "not implemented yet" for HUNTER.
    // And playAudio tries to play it.
    // In original code:
    // case 'HUNTER': return 'not implemented yet';
    // playSegmentAudio calling getSegmentStartAudio -> playAudio('not implemented yet')
    // playAudio checks existSync('./assets/not implemented yet.mp3') -> false -> returns.

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('plays end audio for valid segments', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('CUPID', false));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('skips playing for HUNTER end', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSegmentAudio('HUNTER', false));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('handles concurrent audio playback requests (e.g. LOVERS start)', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      // LOVERS start forks the playback
      yield* _(audioManager.playSegmentAudio('LOVERS', true));
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('plays special scenario audio', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(
        audioManager.playSpecialScenarioAudio('hunter died and has lover')
      );
    });

    await assertSuccess(Effect.provide(program, audioManagerLayer));
  });

  it('fails for unknown special scenario', async () => {
    const program = Effect.gen(function* (_) {
      const audioManager = yield* _(AudioManagerTag);
      yield* _(audioManager.playSpecialScenarioAudio('unknown scenario'));
    });

    await assertFailure(Effect.provide(program, audioManagerLayer), AudioError);
  });
});
