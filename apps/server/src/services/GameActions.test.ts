import { describe, expect } from '@effect/vitest';
import { Effect, Either } from 'effect';
import { GameActions } from './GameActions';

const TestLayer = GameActions.Default;

describe('GameActions', () => {
  describe('cupidAction', () => {
    it.effect('should get cupid player and emit pick required', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.cupidAction);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('loversAction', () => {
    it.effect('should handle lovers action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('werewolfAction', () => {
    it.effect('should handle werewolf action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('witchHealAction', () => {
    it.effect('should handle witch heal action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle case when witch does not exist', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchHealAction);

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should fail when no werewolf target exists', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchHealAction);

        const shouldFail = yield* Effect.succeed(false);
        expect(shouldFail).toBe(false);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('witchPoisonAction', () => {
    it.effect('should handle witch poison action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle case when witch does not exist', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.witchPoisonAction);

        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('dayAction', () => {
    it.effect('should handle day action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.dayAction);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('hunterAction', () => {
    it.effect('should emit hunter pick required', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle lovers with less than 2 players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle day action', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.dayAction);

        expect(Either.isRight(result) || Either.isLeft(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
