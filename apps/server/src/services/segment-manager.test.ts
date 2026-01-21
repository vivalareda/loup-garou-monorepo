import { describe, expect, test } from '@effect/vitest';
import { Effect } from 'effect';
import type { SegmentType } from '@repo/types';
import { SegmentNotFound, SegmentManager } from './segment-manager.js';

describe('SegmentManager', () => {
  test('should initialize segments correctly', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const segments = yield* manager.getAllSegments;

      expect(segments).toHaveLength(7);
      expect(segments[0].type).toBe('CUPID');
      expect(segments[0].skip).toBe(false);
      expect(segments[1].type).toBe('LOVERS');
      expect(segments[1].skip).toBe(false);
      expect(segments[2].type).toBe('WEREWOLF');
      expect(segments[2].skip).toBe(false);
      expect(segments[3].type).toBe('WITCH-HEAL');
      expect(segments[3].skip).toBe(true);
      expect(segments[4].type).toBe('WITCH-POISON');
      expect(segments[4].skip).toBe(true);
      expect(segments[5].type).toBe('DAY');
      expect(segments[5].skip).toBe(false);
      expect(segments[6].type).toBe('HUNTER');
      expect(segments[6].skip).toBe(true);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should get only non-skipped segments', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const segments = yield* manager.getSegments;

      expect(segments).toHaveLength(3);
      expect(segments.map((s) => s.type)).toEqual([
        'CUPID',
        'LOVERS',
        'WEREWOLF',
      ] as SegmentType[]);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should get current segment type', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const currentType = yield* manager.getCurrentSegmentType;

      expect(currentType).toBe('CUPID');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should get current segment', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const currentSegment = yield* manager.getCurrentSegment;

      expect(currentSegment.type).toBe('CUPID');
      expect(currentSegment.skip).toBe(false);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should get segment by type', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const witchHealSegment = yield* manager.getSegmentByType('WITCH-HEAL');

      expect(witchHealSegment.type).toBe('WITCH-HEAL');
      expect(witchHealSegment.skip).toBe(true);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should fail when getting non-existent segment', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const result = yield* Effect.either(
        manager.getSegmentByType('INVALID' as SegmentType)
      );

      expect(result._tag).toBe('Left');
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(SegmentNotFound);
        expect(result.left.type).toBe('INVALID' as SegmentType);
      }
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should identify first night segments', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const isCupidFirstNight = yield* manager.isFirstNightSegment('CUPID');
      const isLoversFirstNight = yield* manager.isFirstNightSegment('LOVERS');
      const isWerewolfFirstNight = yield* manager.isFirstNightSegment(
        'WEREWOLF'
      );

      expect(isCupidFirstNight).toBe(true);
      expect(isLoversFirstNight).toBe(true);
      expect(isWerewolfFirstNight).toBe(false);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should find valid segment skipping skipped ones', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.setSegmentSkip('CUPID', true);
      yield* manager.setSegmentSkip('LOVERS', true);

      const validSegment = yield* manager.findValidSegment;

      expect(validSegment.type).toBe('WEREWOLF');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should loop to beginning when all segments are skipped', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.setSegmentSkip('CUPID', true);
      yield* manager.setSegmentSkip('LOVERS', true);
      yield* manager.setSegmentSkip('WEREWOLF', true);
      yield* manager.setSegmentSkip('DAY', true);
      yield* manager.setSegmentSkip('HUNTER', true);

      const validSegment = yield* manager.findValidSegment;

      expect(validSegment.type).toBe('WITCH-HEAL');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should move to next segment', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const firstType = yield* manager.getCurrentSegmentType;
      expect(firstType).toBe('CUPID');

      const nextSegment = yield* manager.nextSegment;
      expect(nextSegment.type).toBe('LOVERS');

      const nextType = yield* manager.getCurrentSegmentType;
      expect(nextType).toBe('LOVERS');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should skip segments when moving to next', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.setSegmentSkip('LOVERS', true);

      const nextSegment = yield* manager.nextSegment;
      expect(nextSegment.type).toBe('WEREWOLF');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should set segment skip status', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      const before = yield* manager.getSegmentByType('DAY');
      expect(before.skip).toBe(false);

      yield* manager.setSegmentSkip('DAY', true);

      const after = yield* manager.getSegmentByType('DAY');
      expect(after.skip).toBe(true);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should mark first night segments as skipped', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;

      yield* manager.markFirstNightSegmentsAsSkipped;

      const cupidSegment = yield* manager.getSegmentByType('CUPID');
      const loversSegment = yield* manager.getSegmentByType('LOVERS');
      const werewolfSegment = yield* manager.getSegmentByType('WEREWOLF');

      expect(cupidSegment.skip).toBe(true);
      expect(loversSegment.skip).toBe(true);
      expect(werewolfSegment.skip).toBe(false);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should mark witch segments as skipped', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.setSegmentSkip('WITCH-HEAL', false);
      yield* manager.setSegmentSkip('WITCH-POISON', false);

      yield* manager.markWitchSegmentsAsSkipped;

      const witchHealSegment = yield* manager.getSegmentByType('WITCH-HEAL');
      const witchPoisonSegment = yield* manager.getSegmentByType(
        'WITCH-POISON'
      );

      expect(witchHealSegment.skip).toBe(true);
      expect(witchPoisonSegment.skip).toBe(true);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should reset to initial state', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;

      yield* manager.markFirstNightSegmentsAsSkipped;
      yield* manager.setSegmentSkip('WEREWOLF', true);

      yield* manager.reset;

      const cupidSegment = yield* manager.getSegmentByType('CUPID');
      const loversSegment = yield* manager.getSegmentByType('LOVERS');
      const werewolfSegment = yield* manager.getSegmentByType('WEREWOLF');

      expect(cupidSegment.skip).toBe(false);
      expect(loversSegment.skip).toBe(false);
      expect(werewolfSegment.skip).toBe(false);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should loop back to first segment after last', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.setSegmentSkip('CUPID', true);
      yield* manager.setSegmentSkip('LOVERS', true);
      yield* manager.setSegmentSkip('WEREWOLF', true);
      yield* manager.setSegmentSkip('WITCH-HEAL', true);
      yield* manager.setSegmentSkip('WITCH-POISON', true);
      yield* manager.setSegmentSkip('DAY', true);

      const segment1 = yield* manager.getCurrentSegmentType;
      expect(segment1).toBe('HUNTER');

      yield* manager.nextSegment;

      const segment2 = yield* manager.getCurrentSegmentType;
      expect(segment2).toBe('HUNTER');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should handle multiple findValidSegment calls', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;

      const valid1 = yield* manager.findValidSegment;
      expect(valid1.type).toBe('CUPID');

      yield* manager.setSegmentSkip('CUPID', true);

      const valid2 = yield* manager.findValidSegment;
      expect(valid2.type).toBe('LOVERS');

      yield* manager.setSegmentSkip('LOVERS', true);

      const valid3 = yield* manager.findValidSegment;
      expect(valid3.type).toBe('WEREWOLF');
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should return all segments including skipped ones', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;
      yield* manager.markFirstNightSegmentsAsSkipped;

      const allSegments = yield* manager.getAllSegments;
      const nonSkippedSegments = yield* manager.getSegments;

      expect(allSegments).toHaveLength(7);
      expect(nonSkippedSegments).toHaveLength(3);
    }).pipe(Effect.provide(SegmentManager.Default)));

  test('should maintain state across multiple operations', () =>
    Effect.gen(function* () {
      const manager = yield* SegmentManager;

      let current = yield* manager.getCurrentSegmentType;
      expect(current).toBe('CUPID');

      yield* manager.nextSegment;
      current = yield* manager.getCurrentSegmentType;
      expect(current).toBe('LOVERS');

      yield* manager.nextSegment;
      current = yield* manager.getCurrentSegmentType;
      expect(current).toBe('WEREWOLF');

      yield* manager.markFirstNightSegmentsAsSkipped;

      yield* manager.nextSegment;
      current = yield* manager.getCurrentSegmentType;
      expect(current).toBe('DAY');
    }).pipe(Effect.provide(SegmentManager.Default)));
});
