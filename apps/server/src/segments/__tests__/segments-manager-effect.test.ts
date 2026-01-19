import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameActionsService } from '../../core/game-actions-effect';
import { GameService } from '../../core/game-effect';
import { AudioManagerTag } from '../audio-manager-effect';
import {
  SegmentsManagerLive,
  SegmentsManagerService,
} from '../segments-manager-effect';

describe('SegmentsManagerService', () => {
  const mockAudioService = {
    playSegmentAudio: vi.fn().mockReturnValue(Effect.void),
  };

  const mockGameService = {}; // Placeholder

  const mockGameActionsService = {
    cupidAction: Effect.void,
    loversAction: Effect.void,
    werewolfAction: Effect.void,
    witchHealAction: Effect.void,
    witchPoisonAction: Effect.void,
    dayAction: Effect.void,
    hunterAction: Effect.void,
  };

  const AudioManagerTest = Layer.succeed(
    AudioManagerTag,
    mockAudioService as unknown as typeof AudioManagerTag.Service
  );

  const GameServiceTest = Layer.succeed(
    GameService,
    mockGameService as unknown as typeof GameService.Service
  );

  const GameActionsServiceTest = Layer.succeed(
    GameActionsService,
    mockGameActionsService as unknown as typeof GameActionsService.Service
  );

  const TestLayer = SegmentsManagerLive.pipe(
    Layer.provide(AudioManagerTest),
    Layer.provide(GameServiceTest),
    Layer.provide(GameActionsServiceTest)
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize segments correctly', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(SegmentsManagerService);
      yield* _(service.initializeSegments);
      const type = yield* _(service.getCurrentSegmentType);
      return type;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(result).toBe('CUPID');
  });

  it('should skip segments marked as skip=true', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(SegmentsManagerService);
      yield* _(service.initializeSegments);

      // Initially at CUPID (index 0)
      // Finish CUPID -> should go to LOVERS (index 1)
      yield* _(service.finishSegment);
      const type1 = yield* _(service.getCurrentSegmentType);
      expect(type1).toBe('LOVERS');

      // Finish LOVERS -> should go to WEREWOLF (index 2)
      yield* _(service.finishSegment);
      const type2 = yield* _(service.getCurrentSegmentType);
      expect(type2).toBe('WEREWOLF');

      // Finish WEREWOLF -> should skip WITCH-HEAL (index 3, skip=true) and WITCH-POISON (index 4, skip=true)
      // and go to DAY (index 5)
      yield* _(service.finishSegment);
      const type3 = yield* _(service.getCurrentSegmentType);
      return type3;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(result).toBe('DAY');
  });

  it('should wrap around when all segments are finished', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(SegmentsManagerService);
      yield* _(service.initializeSegments);

      // Advance to the end (HUNTER is last, index 6, skip=true)
      // DAY is index 5.
      // Let's assume we are at DAY.
      // We need to manually advance state or just call finishSegment multiple times.

      // CUPID -> LOVERS
      yield* _(service.finishSegment);
      // LOVERS -> WEREWOLF
      yield* _(service.finishSegment);
      // WEREWOLF -> DAY (skips witches)
      yield* _(service.finishSegment);

      const typeAtDay = yield* _(service.getCurrentSegmentType);
      expect(typeAtDay).toBe('DAY');

      // DAY -> CUPID (skips HUNTER, wraps around)
      // However, CUPID should be marked as skip=true after first run if we implement markFirstNightSegment correctly
      // Wait, markFirstNightSegment sets skip=true for CUPID and LOVERS.
      // So next loop:
      // DAY -> HUNTER(skip) -> 0:CUPID(skip) -> 1:LOVERS(skip) -> 2:WEREWOLF

      yield* _(service.finishSegment);
      const typeAtNext = yield* _(service.getCurrentSegmentType);
      return typeAtNext;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(result).toBe('WEREWOLF');
  });

  it('should fail if playSegment called without initialization', async () => {
    const program = Effect.gen(function* (_) {
      const service = yield* _(SegmentsManagerService);
      // Not calling initializeSegments
      yield* _(service.playSegment);
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
    ).rejects.toThrow();
  });

  it('should handle errors during segment execution', async () => {
    const error = new Error('Action failed');
    const mockGameActionsWithError = {
      ...mockGameActionsService,
      werewolfAction: Effect.fail(error),
    };

    const GameActionsErrorTest = Layer.succeed(
      GameActionsService,
      mockGameActionsWithError as unknown as typeof GameActionsService.Service
    );

    const ErrorTestLayer = SegmentsManagerLive.pipe(
      Layer.provide(AudioManagerTest),
      Layer.provide(GameServiceTest),
      Layer.provide(GameActionsErrorTest)
    );

    const program = Effect.gen(function* (_) {
      const service = yield* _(SegmentsManagerService);
      yield* _(service.initializeSegments);

      // Advance to WEREWOLF segment
      yield* _(service.finishSegment); // CUPID -> LOVERS
      yield* _(service.finishSegment); // LOVERS -> WEREWOLF

      // Playing WEREWOLF should fail
      yield* _(service.playSegment);
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(ErrorTestLayer)))
    ).rejects.toThrow('Action failed');
  });
});
