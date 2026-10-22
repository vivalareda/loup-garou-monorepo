import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { SpecialScenarios } from '@/core/special-scenarios';
import { enterSegment } from '@/__tests__/helpers/segments';
import { AudioManager } from '@/segments/audio-manager';
import {
  resolveSegmentTimeoutMs,
  SegmentsManager,
} from '@/segments/segments-manager';
import type { Broadcaster } from '@/server/broadcaster';

const fakeIo = () =>
  ({
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  }) satisfies Broadcaster;

describe('SegmentsManager', () => {
  let segmentsManager: SegmentsManager;
  let mockIo: ReturnType<typeof fakeIo>;
  let game: Game;
  let audioManager: AudioManager;

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<Player['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);

    if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
      game.setSpecialRolePlayer(player);
    }

    return player;
  };

  beforeEach(() => {
    mockIo = fakeIo();
    const deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
    audioManager = new AudioManager(deathManager);
    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );

    // Cupid joins first, so the two players after it are the lovers a
    // Cupid timeout picks; no seer or witch, so their phases auto-skip
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
  });

  afterEach(() => {
    // Clears any segment deadline a test scheduled
    segmentsManager.resetForNewGame();
    vi.restoreAllMocks();
  });

  test('runs Cupid and Lovers once on night one, then skips them later', async () => {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);

    expect(segmentsManager.getCurrentSegmentType()).toBe('LOBBY');
    segmentsManager.startGame();
    expect(segmentsManager.getCurrentSegmentType()).toBe('CUPID');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('SEER');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WEREWOLF');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-HEAL');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-POISON');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('DAY');

    // Night two parks on Cupid; playing it passes over Cupid and Lovers.
    // The Seer wakes every night, so the cycle stops there.
    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('CUPID');
    await SegmentsManager.prototype.playSegment.call(segmentsManager);
    expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');
    await SegmentsManager.prototype.playSegment.call(segmentsManager);
    expect(segmentsManager.getCurrentSegmentType()).toBe('SEER');
  });

  test('should play werewolf winning audio to announce win', () => {
    const winAudio = vi.spyOn(audioManager, 'playWerewolvesWonAudio');
    enterSegment(segmentsManager, 'DAY');

    // Both plain villagers die: the wolf against Cupid is wolf parity
    for (const player of game.getPlayerList().values()) {
      if (player.getRole() === 'VILLAGER') {
        game.handlePlayerDeath(player);
      }
    }

    expect(segmentsManager.isGameOver()).toBe(true);
    expect(winAudio).toHaveBeenCalled();
    expect(segmentsManager.getCurrentSegmentType()).toBe('FINISHED');
  });

  test('emits client-safe phase changes when a segment starts', async () => {
    enterSegment(segmentsManager, 'CUPID');

    await SegmentsManager.prototype.playSegment.call(segmentsManager);

    expect(mockIo.emit).toHaveBeenCalledWith('game:phase-changed', 'CUPID');
  });

  test('Cupid timeout chooses the first two eligible players and advances', async () => {
    vi.useFakeTimers();
    vi.stubEnv('SEGMENT_TIMEOUT_MS', '1000');
    // Only the segments a test plays explicitly run; transitions park
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    const setLovers = vi.spyOn(game, 'setLovers');

    try {
      segmentsManager.startGame();
      // Playing Cupid for real schedules its deadline
      await SegmentsManager.prototype.playSegment.call(segmentsManager);
      await vi.advanceTimersByTimeAsync(1000);

      expect(setLovers).toHaveBeenCalledWith(['p2-sid', 'p3-sid']);
      expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  test('each segment resolves its own deadline duration', () => {
    // Defaults are per-segment, not one shared value
    expect(resolveSegmentTimeoutMs('CUPID')).toBe(120_000);
    expect(resolveSegmentTimeoutMs('LOVERS')).toBe(60_000);
    expect(resolveSegmentTimeoutMs('WEREWOLF')).toBe(120_000);
    expect(resolveSegmentTimeoutMs('WITCH-HEAL')).toBe(60_000);
    expect(resolveSegmentTimeoutMs('WITCH-POISON')).toBe(60_000);
    expect(resolveSegmentTimeoutMs('DAY')).toBe(600_000);
    expect(resolveSegmentTimeoutMs('HUNTER')).toBe(60_000);

    // Each is overridable by its own env var without touching the others
    vi.stubEnv('DAY_VOTE_TIMEOUT_MS', '5000');

    try {
      expect(resolveSegmentTimeoutMs('DAY')).toBe(5000);
      expect(resolveSegmentTimeoutMs('CUPID')).toBe(120_000);
    } finally {
      vi.unstubAllEnvs();
    }

    // The global override still wins over defaults for every segment
    vi.stubEnv('SEGMENT_TIMEOUT_MS', '1234');

    try {
      expect(resolveSegmentTimeoutMs('CUPID')).toBe(1234);
      expect(resolveSegmentTimeoutMs('DAY')).toBe(1234);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  test('two segments run on their own distinct deadline durations', async () => {
    vi.useFakeTimers();
    vi.stubEnv('CUPID_TIMEOUT_MS', '2000');
    vi.stubEnv('LOVERS_TIMEOUT_MS', '500');
    // Only the segments a test plays explicitly run; transitions park
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);

    // Playing a segment for real is what schedules its deadline
    const playCurrentSegment = () =>
      SegmentsManager.prototype.playSegment.call(segmentsManager);

    try {
      segmentsManager.startGame();
      await playCurrentSegment();

      // The Cupid deadline (2000ms) must NOT fire at the Lovers duration
      await vi.advanceTimersByTimeAsync(500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('CUPID');
      await vi.advanceTimersByTimeAsync(1500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');

      // The Lovers deadline fires at its own, shorter duration
      await playCurrentSegment();
      await vi.advanceTimersByTimeAsync(500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('SEER');
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  test('auto-skips unavailable Witch phases', async () => {
    // Transitions park instead of playing the next segment
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    enterSegment(segmentsManager, 'WITCH-HEAL');

    // No witch joined: WITCH-HEAL skips itself and stops on WITCH-POISON
    await SegmentsManager.prototype.playSegment.call(segmentsManager);

    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-POISON');
  });
});
