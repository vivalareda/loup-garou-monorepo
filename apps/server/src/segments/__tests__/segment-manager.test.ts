/** biome-ignore-all lint/suspicious/noEmptyBlockStatements: <mock file> */
import { existsSync } from 'node:fs';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  type MockedFunction,
  test,
  vi,
} from 'vitest';
import type { Game } from '@/core/game';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import {
  resolveSegmentTimeoutMs,
  SegmentsManager,
} from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

vi.mock('sound-play');
vi.mock('node:fs');

describe('SegmentsManager', () => {
  let segmentsManager: SegmentsManager;
  let mockIo: SocketType;
  let mockFs: MockedFunction<typeof vi.mocked>;
  let mockGame: Game;
  let mockAudioManager: AudioManager;

  beforeEach(() => {
    mockGame = {
      getWerewolfList: vi
        .fn()
        .mockReturnValue([
          { getSocketId: () => 'werewolf1-socket-id' },
          { getSocketId: () => 'werewolf2-socket-id' },
        ]),
      getSpecialRolePlayer: vi.fn().mockReturnValue({ getSocketId: () => 'cupid-sid' }),
      getAlivePlayers: vi.fn().mockReturnValue([
        { getSocketId: () => 'cupid-sid' },
        { getSocketId: () => 'p2-sid' },
        { getSocketId: () => 'p3-sid' },
      ]),
      setLovers: vi.fn(),
      canWitchHeal: vi.fn().mockReturnValue(true),
      canWitchPoison: vi.fn().mockReturnValue(true),
      getWerewolfTarget: vi.fn().mockReturnValue('victim-sid'),
      getLovers: vi.fn().mockReturnValue([
        { getSocketId: () => 'p2-sid', getName: () => 'P2' },
        { getSocketId: () => 'p3-sid', getName: () => 'P3' },
      ]),
      processPendingDeaths: vi.fn().mockReturnValue([]),
      checkIfWinner: vi.mocked('werewolves'),
    } as unknown as Game;
    mockFs = vi.mocked(existsSync);

    mockFs.mockReturnValue(true);

    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    mockAudioManager = {
      playSegmentAudio: vi.fn(),
    } as unknown as AudioManager;

    const mockSpecialScenarios = {
      secondLoverIsHunter: vi.fn(),
      partnerIsHunter: vi.fn(),
    } as unknown as SpecialScenarios;

    segmentsManager = new SegmentsManager(
      mockGame,
      mockIo,
      mockAudioManager,
      mockSpecialScenarios
    );
  });

  afterEach(() => {
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
    expect(segmentsManager.getCurrentSegmentType()).toBe('WEREWOLF');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-HEAL');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-POISON');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('DAY');

    await segmentsManager.finishSegment();
    expect(segmentsManager.getCurrentSegmentType()).toBe('WEREWOLF');
  });

  test('should play werewolf winning audio to announce win', () => {
    segmentsManager.currentSegment = 4;
  });

  test('emits client-safe phase changes when a segment starts', async () => {
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted = true;

    await SegmentsManager.prototype.playSegment.call(segmentsManager);

    expect(mockIo.emit).toHaveBeenCalledWith('game:phase-changed', 'CUPID');
  });

  test('Cupid timeout chooses the first two eligible players and advances', async () => {
    vi.useFakeTimers();
    process.env.SEGMENT_TIMEOUT_MS = '1000';
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    vi.mocked(mockGame.getLovers).mockReturnValue([]);

    try {
      segmentsManager.startGame();
      (
        segmentsManager as unknown as { scheduleDeadline: (segment: string) => void }
      ).scheduleDeadline('CUPID');
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockGame.setLovers).toHaveBeenCalledWith(['p2-sid', 'p3-sid']);
      expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');
    } finally {
      delete process.env.SEGMENT_TIMEOUT_MS;
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
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    vi.mocked(mockGame.getLovers).mockReturnValue([]);
    const schedule = (
      segmentsManager as unknown as {
        scheduleDeadline: (segment: string) => void;
      }
    ).scheduleDeadline.bind(segmentsManager);

    try {
      segmentsManager.startGame();
      schedule('CUPID');

      // The Cupid deadline (2000ms) must NOT fire at the Lovers duration
      await vi.advanceTimersByTimeAsync(500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('CUPID');
      await vi.advanceTimersByTimeAsync(1500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('LOVERS');

      // The Lovers deadline fires at its own, shorter duration
      schedule('LOVERS');
      await vi.advanceTimersByTimeAsync(500);
      expect(segmentsManager.getCurrentSegmentType()).toBe('WEREWOLF');
    } finally {
      vi.unstubAllEnvs();
      vi.useRealTimers();
    }
  });

  test('auto-skips unavailable Witch phases', async () => {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    vi.mocked(mockGame.getSpecialRolePlayer).mockReturnValue(undefined);
    segmentsManager.currentSegment = segmentsManager.segments.findIndex(
      (segment) => segment.type === 'WITCH-HEAL'
    );
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted = true;

    await SegmentsManager.prototype.playSegment.call(segmentsManager);

    expect(segmentsManager.getCurrentSegmentType()).toBe('WITCH-POISON');
  });
});
