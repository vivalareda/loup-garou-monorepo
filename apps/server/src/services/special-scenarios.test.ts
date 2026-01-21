import { describe, expect, it } from '@effect/vitest';
import { Effect, Either, Layer } from 'effect';
import { AudioManager } from './audio-manager.js';
import { SpecialScenarios } from './special-scenarios.js';

const TestLayer = Layer.merge(AudioManager.Default, SpecialScenarios.Default);

describe('SpecialScenarios', () => {
  describe('partnerIsHunter', () => {
    it.effect('should set hunterDiedFirst flag to true', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        const result = yield* Effect.either(specialScenarios.partnerIsHunter);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);

        const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

        expect(hunterDiedFirst).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('hunterIsLover', () => {
    it.effect('should not modify hunterDiedFirst flag', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        const before = yield* specialScenarios.getHunterDiedFirst;

        const result = yield* Effect.either(specialScenarios.hunterIsLover);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);

        const after = yield* specialScenarios.getHunterDiedFirst;

        expect(after).toBe(before);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('getHunterDiedFirst', () => {
    it.effect('should return false initially', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

        expect(hunterDiedFirst).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return true after partnerIsHunter', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        const result = yield* Effect.either(specialScenarios.partnerIsHunter);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);

        const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

        expect(hunterDiedFirst).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should return false after multiple hunterIsLover calls', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        yield* Effect.either(specialScenarios.hunterIsLover);
        yield* Effect.either(specialScenarios.hunterIsLover);
        yield* Effect.either(specialScenarios.hunterIsLover);

        const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

        expect(hunterDiedFirst).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('resetHunterDiedFirst', () => {
    it.effect('should reset hunterDiedFirst to false', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        yield* Effect.either(specialScenarios.partnerIsHunter);

        const beforeReset = yield* specialScenarios.getHunterDiedFirst;
        expect(beforeReset).toBe(true);

        yield* specialScenarios.resetHunterDiedFirst;

        const afterReset = yield* specialScenarios.getHunterDiedFirst;
        expect(afterReset).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should not affect flag if already false', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        const beforeReset = yield* specialScenarios.getHunterDiedFirst;
        expect(beforeReset).toBe(false);

        yield* specialScenarios.resetHunterDiedFirst;

        const afterReset = yield* specialScenarios.getHunterDiedFirst;
        expect(afterReset).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should allow multiple resets', () =>
      Effect.gen(function* () {
        const specialScenarios = yield* SpecialScenarios;

        yield* Effect.either(specialScenarios.partnerIsHunter);

        for (let i = 0; i < 5; i++) {
          yield* specialScenarios.resetHunterDiedFirst;
          const flag = yield* specialScenarios.getHunterDiedFirst;
          expect(flag).toBe(false);
        }
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
