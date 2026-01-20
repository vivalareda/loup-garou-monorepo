import { existsSync } from 'node:fs';
import { Config, Effect, Layer } from 'effect';
import sound from 'sound-play';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../AudioManager.js';

// Mock dependencies
vi.mock('sound-play', () => ({
  default: {
    play: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

describe('AudioManager', () => {
  let audioManager: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    (existsSync as any).mockReturnValue(true);

    const layer = AudioManager.Default;
    const runtime = Layer.toRuntime(layer);
    audioManager = await Effect.runPromise(Effect.provide(AudioManager, layer));
  });

  it('should play start audio for known segments', async () => {
    await Effect.runPromise(audioManager.playSegmentStart('CUPID'));
    expect(sound.play).toHaveBeenCalledWith(
      expect.stringContaining('Cupidon/Cupidon-1.mp3')
    );
  });

  it('should play end audio for known segments', async () => {
    await Effect.runPromise(audioManager.playSegmentEnd('CUPID'));
    expect(sound.play).toHaveBeenCalledWith(
      expect.stringContaining('Cupidon/Cupidon-2.mp3')
    );
  });

  it('should not play audio for segments without mapping', async () => {
    await Effect.runPromise(
      audioManager.playSegmentStart('UNKNOWN_SEGMENT' as any)
    );
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('should handle missing files gracefully', async () => {
    (existsSync as any).mockReturnValue(false);
    await Effect.runPromise(audioManager.playSegmentStart('CUPID'));
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('should play correct winner audio', async () => {
    await Effect.runPromise(audioManager.playWinnerAudio('werewolves'));
    expect(sound.play).toHaveBeenCalledWith(
      expect.stringContaining('End-game/Werewolves-won.mp3')
    );

    await Effect.runPromise(audioManager.playWinnerAudio('villagers'));
    expect(sound.play).toHaveBeenCalledWith(
      expect.stringContaining('End-game/Villagers-won.mp3')
    );
  });
});
