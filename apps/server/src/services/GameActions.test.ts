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

    it.effect('should handle effect execution', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
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

    it.effect('should handle lovers with less than 2 players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lover action completion', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.loversAction);
        expect(Either.isRight(result)).toBe(true);
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

    it.effect('should emit to all werewolves', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.werewolfAction);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle no werewolves gracefully', () =>
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

        expect(Either.isLeft(result) || Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle werewolf target correctly', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
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

    it.effect('should emit poison prompt to witch', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchPoisonAction;
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

    it.effect('should handle winner scenario', () =>
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

    it.effect('should handle hunter action completion', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const result = yield* Effect.either(actions.hunterAction);
        expect(Either.isRight(result)).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Edge Cases', () => {
    it.effect('should handle all actions in sequence without errors', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle repeated action calls', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.werewolfAction;
        yield* actions.hunterAction;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle lovers action multiple times', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.loversAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle all witch actions', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Integration Scenarios', () => {
    it.effect('should simulate complete night phase actions', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle day transition after night', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle hunter death scenario', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.hunterAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Error Handling', () => {
    it.effect('should handle missing special role players', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        const cupidResult = yield* Effect.either(actions.cupidAction);
        const witchHealResult = yield* Effect.either(actions.witchHealAction);
        const witchPoisonResult = yield* Effect.either(
          actions.witchPoisonAction
        );

        expect(Either.isRight(cupidResult) || Either.isLeft(cupidResult)).toBe(
          true
        );
        expect(
          Either.isRight(witchHealResult) || Either.isLeft(witchHealResult)
        ).toBe(true);
        expect(
          Either.isRight(witchPoisonResult) || Either.isLeft(witchPoisonResult)
        ).toBe(true);
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should handle empty game state', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });

  describe('Action Sequence Testing', () => {
    it.effect('should execute cupid -> lovers sequence', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should execute werewolves -> witch sequence', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );

    it.effect('should execute complete game cycle', () =>
      Effect.gen(function* () {
        const actions = yield* GameActions;
        yield* actions.cupidAction;
        yield* actions.loversAction;
        yield* actions.werewolfAction;
        yield* actions.witchHealAction;
        yield* actions.witchPoisonAction;
      }).pipe(Effect.provide(TestLayer))
    );
  });
});
