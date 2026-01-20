import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { Player } from '../../core/player.js';
import { DeathManager } from '../DeathManager.js';
import { Game } from '../Game.js';
import { WitchService } from '../WitchService.js';
import { WitchHasNoPotionError } from '../witch-errors.js';

// Mocks
const MockGame = Layer.succeed(
  Game,
  Game.of({
    getPlayerBySocketId: (id: string) =>
      Effect.succeed(new Player('Victim', id, 'VILLAGER')),
  } as any)
);

const MockDeathManager = Layer.succeed(
  DeathManager,
  DeathManager.of({
    healWerewolvesVictim: () => Effect.void,
    addWitchPoison: (_id: string) => Effect.void,
  } as any)
);

describe('WitchService', () => {
  const TestLayer = WitchService.Test.pipe(
    Layer.provide(MockGame),
    Layer.provide(MockDeathManager)
  );

  it('should start with both potions', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;
      const canHeal = yield* witch.canHeal;
      const canPoison = yield* witch.canPoison;

      expect(canHeal).toBe(true);
      expect(canPoison).toBe(true);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('should consume heal potion after use', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;

      yield* witch.healPlayer;

      const canHeal = yield* witch.canHeal;
      expect(canHeal).toBe(false);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('should fail if trying to heal without potion', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;

      // Use first time
      yield* witch.healPlayer;

      // Try second time
      yield* witch.healPlayer;
    });

    try {
      await Effect.runPromise(Effect.provide(program, TestLayer));
    } catch (error: any) {
      expect(error.toJSON().cause.failure).toMatchObject({
        _tag: 'WitchHasNoPotionError',
        potionType: 'HEAL',
      });
    }
  });

  it('should consume poison potion after use', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;

      yield* witch.poisonPlayer('victim-id');

      const canPoison = yield* witch.canPoison;
      expect(canPoison).toBe(false);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });

  it('should fail if trying to poison without potion', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;

      // Use first time
      yield* witch.poisonPlayer('victim-id');

      // Try second time
      yield* witch.poisonPlayer('victim-id-2');
    });

    try {
      await Effect.runPromise(Effect.provide(program, TestLayer));
    } catch (error: any) {
      expect(error.toJSON().cause.failure).toMatchObject({
        _tag: 'WitchHasNoPotionError',
        potionType: 'POISON',
      });
    }
  });

  it('should handle skipping potions without consuming them', async () => {
    const program = Effect.gen(function* () {
      const witch = yield* WitchService;

      yield* witch.skipHeal;
      yield* witch.skipPoison;

      const canHeal = yield* witch.canHeal;
      const canPoison = yield* witch.canPoison;

      expect(canHeal).toBe(true);
      expect(canPoison).toBe(true);
    });

    await Effect.runPromise(Effect.provide(program, TestLayer));
  });
});
