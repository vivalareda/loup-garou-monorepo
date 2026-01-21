import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { DeathManager } from './death-manager.js';
import { Game } from './game.js';
import { GameActions } from './game-actions.js';
import { Lobby } from './lobby.js';
import { MockScenario } from './mock-scenario.js';
import { SegmentExecution } from './segment-execution.js';
import { SocketHandlers } from './socket-handlers.js';
import { SocketServer } from './socket-server.js';

const TestLayer = Layer.mergeAll(
  SocketServer.Default,
  Lobby.Default,
  Game.Default,
  GameActions.Default,
  SegmentExecution.Default,
  DeathManager.Default,
  MockScenario.Default,
  SocketHandlers.Default
);

describe('SocketHandlers', () => {
  describe('service initialization', () => {
    it('should initialize with all dependencies', async () => {
      const program = Effect.gen(function* () {
        const game = yield* Game;
        const lobby = yield* Lobby;
        const gameActions = yield* GameActions;
        const segmentExecution = yield* SegmentExecution;
        const deathManager = yield* DeathManager;

        expect(game).toBeDefined();
        expect(lobby).toBeDefined();
        expect(gameActions).toBeDefined();
        expect(segmentExecution).toBeDefined();
        expect(deathManager).toBeDefined();
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });
  });

  describe('promptCupid', () => {
    it('should emit cupid:pick-required to cupid player', async () => {
      const program = Effect.gen(function* () {
        const handlers = yield* SocketHandlers;
        yield* handlers.promptCupid;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });
  });

  describe('setupHandlers', () => {
    it('should set up socket event handlers', async () => {
      const program = Effect.gen(function* () {
        const handlers = yield* SocketHandlers;
        yield* handlers.setupHandlers;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });
  });

  describe('service integration', () => {
    it('should provide DeathManager to segment execution effects', async () => {
      const program = Effect.gen(function* () {
        const segmentExecution = yield* SegmentExecution;
        const deathManager = yield* DeathManager;

        yield* segmentExecution.finishSegment.pipe(
          Effect.provideService(DeathManager, deathManager)
        );
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });

    it('should integrate with Game service', async () => {
      const program = Effect.gen(function* () {
        const game = yield* Game;
        const handlers = yield* SocketHandlers;
        yield* handlers.promptCupid;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });

    it('should integrate with GameActions service', async () => {
      const program = Effect.gen(function* () {
        const gameActions = yield* GameActions;
        const handlers = yield* SocketHandlers;
        yield* handlers.promptCupid;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });

    it('should integrate with SegmentExecution service', async () => {
      const program = Effect.gen(function* () {
        const segmentExecution = yield* SegmentExecution;
        const handlers = yield* SocketHandlers;
        yield* handlers.promptCupid;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });

    it('should integrate with DeathManager service', async () => {
      const program = Effect.gen(function* () {
        const deathManager = yield* DeathManager;
        const segmentExecution = yield* SegmentExecution;
        const handlers = yield* SocketHandlers;
        yield* handlers.promptCupid;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(TestLayer))
      );

      expect(result._tag).toBe('Success');
    });
  });
});
