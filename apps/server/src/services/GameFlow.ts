import type { SegmentType } from '@repo/types';
import { Effect, Ref } from 'effect';
import { AudioManager } from './AudioManager.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { SocketServer } from './SocketServer.js';

export type SegmentState = {
  type: SegmentType;
  skip: boolean;
};

export class GameFlow extends Effect.Service<GameFlow>()('GameFlow', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const lobby = yield* Lobby;
    const io = yield* SocketServer;
    const audio = yield* AudioManager;

    // Initialize segments with proper skip states based on segments-manager.ts logic
    const initialSegments: SegmentState[] = [
      { type: 'CUPID', skip: false },
      { type: 'LOVERS', skip: false },
      { type: 'WEREWOLF', skip: false },
      { type: 'WITCH-HEAL', skip: true }, // Starts as skip=true in original
      { type: 'WITCH-POISON', skip: true }, // Starts as skip=true in original
      { type: 'DAY', skip: false },
      { type: 'HUNTER', skip: true }, // Starts as skip=true in original
    ];

    const segmentsRef = yield* Ref.make(initialSegments);
    const firstNightCompletedRef = yield* Ref.make(false);

    const getSegments = Ref.get(segmentsRef);

    const getSegmentByType = (type: SegmentType) =>
      Effect.gen(function* () {
        const segments = yield* getSegments;
        return segments.find((s) => s.type === type);
      });

    const updateSegmentSkip = (type: SegmentType, skip: boolean) =>
      Effect.gen(function* () {
        const segments = yield* getSegments;
        const updated = segments.map((s) =>
          s.type === type ? { ...s, skip } : s
        );
        yield* Ref.set(segmentsRef, updated);
      });

    const skipSegment = (type: SegmentType) =>
      Effect.gen(function* () {
        yield* updateSegmentSkip(type, true);
      });

    const unskipSegment = (type: SegmentType) =>
      Effect.gen(function* () {
        yield* updateSegmentSkip(type, false);
      });

    const shouldSkipCupid = Effect.gen(function* () {
      const firstNightCompleted = yield* Ref.get(firstNightCompletedRef);
      return firstNightCompleted;
    });

    const shouldSkipLovers = Effect.gen(function* () {
      const firstNightCompleted = yield* Ref.get(firstNightCompletedRef);
      return firstNightCompleted;
    });

    const shouldSkipWitchHeal = Effect.gen(function* () {
      const canHeal = yield* game.canWitchHeal;
      return !canHeal;
    });

    const shouldSkipWitchPoison = Effect.gen(function* () {
      const canPoison = yield* game.canWitchPoison;
      return !canPoison;
    });

    const shouldSkipHunter = Effect.gen(function* () {
      const hunterInDeathQueue = yield* game.hunterIsInDeathQueue;
      return !hunterInDeathQueue;
    });

    const applySkipLogic = Effect.gen(function* () {
      // Cupid and Lovers skip after first night
      const skipCupid = yield* shouldSkipCupid;
      const skipLovers = yield* shouldSkipLovers;
      if (skipCupid) {
        yield* updateSegmentSkip('CUPID', true);
      }
      if (skipLovers) {
        yield* updateSegmentSkip('LOVERS', true);
      }

      // Witch segments skip when no potions
      const skipWitchHeal = yield* shouldSkipWitchHeal;
      const skipWitchPoison = yield* shouldSkipWitchPoison;
      yield* updateSegmentSkip('WITCH-HEAL', skipWitchHeal);
      yield* updateSegmentSkip('WITCH-POISON', skipWitchPoison);

      // Hunter skips unless in death queue
      const skipHunter = yield* shouldSkipHunter;
      yield* updateSegmentSkip('HUNTER', skipHunter);
    });

    const markFirstNightComplete = Effect.gen(function* () {
      yield* Ref.set(firstNightCompletedRef, true);
    });

    return {
      getSegments,
      getSegmentByType,
      skipSegment,
      unskipSegment,
      applySkipLogic,
      markFirstNightComplete,
      shouldSkipCupid,
      shouldSkipLovers,
      shouldSkipWitchHeal,
      shouldSkipWitchPoison,
      shouldSkipHunter,

      startGame: Effect.gen(function* () {
        yield* game.startGame;

        const players = yield* game.getPlayers;
        for (const player of players) {
          io.to(player.getSocketId()).emit(
            'player:role-assigned',
            player.getRole()
          );
        }

        yield* lobby.clear;

        yield* audio.playIntro();
      }),
    };
  }),
  dependencies: [
    Game.Default,
    Lobby.Default,
    SocketServer.Default,
    AudioManager.Default,
  ],
}) {}
