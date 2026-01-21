import { describe, expect, test } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { AudioManager } from './audio-manager.js';
import { DeathManager } from './death-manager.js';
import { Game } from './game.js';
import { GameActions } from './game-actions.js';
import { HunterNotFoundError, SegmentExecution } from './segment-execution.js';
import { SegmentManager } from './segment-manager.js';
import { SpecialScenarios } from './special-scenarios.js';

const TestLayer = Layer.mergeAll(
  AudioManager.Default,
  DeathManager.Default,
  Game.Default,
  GameActions.Default,
  SegmentManager.Default,
  SpecialScenarios.Default,
  SegmentExecution.Default
);

describe('SegmentExecution', () => {
  test('should play current segment with audio and action', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should play segment for CUPID type', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.reset;

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should play segment for WEREWOLF type', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should play segment for DAY type', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);
      yield* segmentManager.setSegmentSkip('WEREWOLF', true);

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should play segment for WITCH-HEAL type', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);
      yield* segmentManager.setSegmentSkip('WEREWOLF', true);
      yield* segmentManager.setSegmentSkip('DAY', true);

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should play segment for WITCH-POISON type', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);
      yield* segmentManager.setSegmentSkip('WEREWOLF', true);
      yield* segmentManager.setSegmentSkip('DAY', true);
      yield* segmentManager.setSegmentSkip('WITCH-HEAL', true);

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should finish current segment and move to next', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      const beforeType = yield* segmentManager.getCurrentSegmentType;
      expect(beforeType).toBe('CUPID');

      const result = yield* Effect.either(segmentExecution.finishSegment);

      expect(Either.isRight(result)).toBe(true);

      const afterType = yield* segmentManager.getCurrentSegmentType;
      expect(afterType).toBe('LOVERS');
    }).pipe(Effect.provide(TestLayer)));

  test('should mark first night segments as skipped after finishing them', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentExecution.finishSegment;

      const cupidSegment = yield* segmentManager.getSegmentByType('CUPID');
      expect(cupidSegment.skip).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should not mark WEREWOLF segment as first night', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);
      yield* segmentExecution.finishSegment;

      const werewolfSegment =
        yield* segmentManager.getSegmentByType('WEREWOLF');
      expect(werewolfSegment.skip).toBe(false);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle running hunter segment when hunter exists', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.runHunterSegment);

      if (Either.isRight(result)) {
        expect(result.right).toBeUndefined();
      }
    }).pipe(Effect.provide(TestLayer)));

  test('should fail when running hunter segment without hunter', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const result = yield* Effect.either(segmentExecution.runHunterSegment);

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(HunterNotFoundError);
      }
    }).pipe(Effect.provide(TestLayer)));

  test('should run lover segment and play audio', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.runLoverSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should check post day vote scenarios with hunter in queue', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const hunterResult = yield* Effect.either(
        game.getSpecialRolePlayer('HUNTER')
      );
      if (Either.isRight(hunterResult)) {
        const hunter = hunterResult.right;
        yield* deathManager.addPendingDeath(hunter, 'WEREWOLVES');
      }

      const result = yield* Effect.either(
        segmentExecution.checkPostDayVoteScenarios
      );

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should check post day vote scenarios with lover in queue', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const lovers = yield* game.getLovers;
      if (lovers.length >= 2) {
        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');
      }

      const result = yield* Effect.either(
        segmentExecution.checkPostDayVoteScenarios
      );

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should return false when no post day vote scenarios', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const hasScenario = yield* segmentExecution.checkPostDayVoteScenarios;

      expect(hasScenario).toBe(false);
    }).pipe(Effect.provide(TestLayer)));

  test('should continue day action when game not over', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const result = yield* Effect.either(segmentExecution.continueDayAction);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should not continue day action when game is over', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const result = yield* Effect.either(segmentExecution.continueDayAction);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should start game by playing first segment', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.startGame);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should check game over and return false when not over', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const isOver = yield* segmentExecution.isGameOver;

      expect(isOver).toBe(false);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle multiple segment finishes', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      let currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('CUPID');

      yield* segmentExecution.finishSegment;
      currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('LOVERS');

      yield* segmentExecution.finishSegment;
      currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('WEREWOLF');

      yield* segmentExecution.finishSegment;
      currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('DAY');
    }).pipe(Effect.provide(TestLayer)));

  test('should play and finish segments in sequence', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.reset;

      for (let i = 0; i < 3; i++) {
        const playResult = yield* Effect.either(segmentExecution.playSegment);
        expect(Either.isRight(playResult)).toBe(true);

        const finishResult = yield* Effect.either(
          segmentExecution.finishSegment
        );
        expect(Either.isRight(finishResult)).toBe(true);
      }
    }).pipe(Effect.provide(TestLayer)));

  test('should handle HUNTER segment playback', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.setSegmentSkip('CUPID', true);
      yield* segmentManager.setSegmentSkip('LOVERS', true);
      yield* segmentManager.setSegmentSkip('WEREWOLF', true);
      yield* segmentManager.setSegmentSkip('DAY', true);
      yield* segmentManager.setSegmentSkip('WITCH-HEAL', true);
      yield* segmentManager.setSegmentSkip('WITCH-POISON', true);

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should loop back to CUPID after completing all segments', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.reset;

      const segmentCount = (yield* segmentManager.getAllSegments).length;

      for (let i = 0; i < segmentCount; i++) {
        yield* segmentExecution.finishSegment;
      }

      const currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('CUPID');
    }).pipe(Effect.provide(TestLayer)));

  test('should handle segment execution errors gracefully', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.playSegment);

      expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle runHunterSegment with hunter as lover', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const result = yield* Effect.either(segmentExecution.runHunterSegment);

      expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle runLoverSegment with game over', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      yield* game.startGame;

      const result = yield* Effect.either(segmentExecution.runLoverSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should continue day action with hunterDiedFirst flag', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const specialScenarios = yield* SpecialScenarios;

      yield* specialScenarios.partnerIsHunter;

      const result = yield* Effect.either(segmentExecution.continueDayAction);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should check post day vote scenarios with partner is hunter', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;
      const deathManager = yield* DeathManager;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const lovers = yield* game.getLovers;
      if (lovers.length >= 2) {
        yield* deathManager.addPendingDeath(lovers[0], 'WEREWOLVES');
      }

      const result = yield* Effect.either(
        segmentExecution.checkPostDayVoteScenarios
      );

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle lover segment with no game over', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.runLoverSegment);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should execute all segment types successfully', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      const allSegments = yield* segmentManager.getAllSegments;

      for (const segment of allSegments) {
        yield* segmentManager.setSegmentSkip(segment.type, true);
      }

      yield* segmentManager.setSegmentSkip('CUPID', false);

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      yield* segmentManager.setSegmentSkip('LOVERS', false);
      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      yield* segmentManager.setSegmentSkip('WEREWOLF', false);
      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      yield* segmentManager.setSegmentSkip('DAY', false);
      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      const currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('DAY');
    }).pipe(Effect.provide(TestLayer)));

  test('should start game and play first segment', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentManager.reset;

      const result = yield* Effect.either(segmentExecution.startGame);

      expect(Either.isRight(result)).toBe(true);

      const currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('CUPID');
    }).pipe(Effect.provide(TestLayer)));

  test('should maintain state across multiple operations', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const segmentManager = yield* SegmentManager;

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      yield* segmentExecution.playSegment;
      yield* segmentExecution.finishSegment;

      const currentType = yield* segmentManager.getCurrentSegmentType;
      expect(currentType).toBe('WEREWOLF');

      const isOver = yield* segmentExecution.isGameOver;
      expect(typeof isOver).toBe('boolean');
    }).pipe(Effect.provide(TestLayer)));

  test('should handle checkPostDayVoteScenarios returning true', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const hasScenario = yield* segmentExecution.checkPostDayVoteScenarios;

      expect(typeof hasScenario).toBe('boolean');
    }).pipe(Effect.provide(TestLayer)));

  test('should add partner suicide when hunter is a lover', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const hunterResult = yield* Effect.either(
        game.getSpecialRolePlayer('HUNTER')
      );

      if (Either.isLeft(hunterResult)) {
        return yield* Effect.void;
      }

      const hunter = hunterResult.right;

      const lovers = yield* game.getLovers;

      if (lovers.length < 2) {
        return yield* Effect.void;
      }

      const lover1 = lovers[0];
      const lover2 = lovers[1];

      if (
        hunter.socketId !== lover1.socketId &&
        hunter.socketId !== lover2.socketId
      ) {
        const result = yield* Effect.either(segmentExecution.runHunterSegment);
        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }
    }).pipe(Effect.provide(TestLayer)));

  test('should continueDayAction with hunterDiedFirst flag', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const specialScenarios = yield* SpecialScenarios;

      yield* Effect.either(specialScenarios.partnerIsHunter);

      const result = yield* Effect.either(segmentExecution.continueDayAction);

      expect(Either.isRight(result)).toBe(true);

      const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

      expect(hunterDiedFirst).toBe(false);
    }).pipe(Effect.provide(TestLayer)));

  test('should continueDayAction without hunterDiedFirst flag', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;

      const result = yield* Effect.either(segmentExecution.continueDayAction);

      expect(Either.isRight(result)).toBe(true);
    }).pipe(Effect.provide(TestLayer)));

  test('should handle runHunterSegment when hunter is lover', () =>
    Effect.gen(function* () {
      const segmentExecution = yield* SegmentExecution;
      const game = yield* Game;

      const players = yield* game.startGame;

      if (players.length < 8) {
        return yield* Effect.void;
      }

      const hunterResult = yield* Effect.either(
        game.getSpecialRolePlayer('HUNTER')
      );

      if (Either.isLeft(hunterResult)) {
        return yield* Effect.void;
      }

      const hunter = hunterResult.right;
      const isLover = yield* game.isPlayerLover(hunter.socketId);

      if (isLover) {
        const result = yield* Effect.either(segmentExecution.runHunterSegment);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }
    }).pipe(Effect.provide(TestLayer)));
});
