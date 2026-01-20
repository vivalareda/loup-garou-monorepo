import { Console, Effect, Layer, Ref } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import {
  InvalidWitchTargetError,
  WitchHasNoPotionError,
} from './witch-errors.js';

interface WitchState {
  hasHealPotion: boolean;
  hasPoisonPotion: boolean;
}

const make = Effect.gen(function* () {
  const game = yield* Game;
  const deathManager = yield* DeathManager;

  const witchStateRef = yield* Ref.make<WitchState>({
    hasHealPotion: true,
    hasPoisonPotion: true,
  });

  return {
    _tag: '@app/WitchService' as const,
    // Check if witch has heal potion
    canHeal: Effect.gen(function* () {
      const state = yield* Ref.get(witchStateRef);
      return state.hasHealPotion;
    }),

    // Check if witch has poison potion
    canPoison: Effect.gen(function* () {
      const state = yield* Ref.get(witchStateRef);
      return state.hasPoisonPotion;
    }),

    // Handle heal action
    healPlayer: Effect.gen(function* () {
      const state = yield* Ref.get(witchStateRef);

      if (!state.hasHealPotion) {
        return yield* Effect.fail(
          new WitchHasNoPotionError({ potionType: 'HEAL' })
        );
      }

      // Heal logic - removing pending death from werewolves
      yield* deathManager.healWerewolvesVictim();

      // Update state
      yield* Ref.update(witchStateRef, (s) => ({ ...s, hasHealPotion: false }));

      yield* Console.log('[Witch] Used heal potion');
    }),

    // Handle poison action
    poisonPlayer: (targetId: string) =>
      Effect.gen(function* () {
        const state = yield* Ref.get(witchStateRef);

        if (!state.hasPoisonPotion) {
          return yield* Effect.fail(
            new WitchHasNoPotionError({ potionType: 'POISON' })
          );
        }

        const target = yield* game.getPlayerBySocketId(targetId);
        if (!target.isAlive) {
          return yield* Effect.fail(
            new InvalidWitchTargetError({ reason: 'Target is already dead' })
          );
        }

        // Poison logic - add pending death
        yield* deathManager.addWitchPoison(targetId);

        // Update state
        yield* Ref.update(witchStateRef, (s) => ({
          ...s,
          hasPoisonPotion: false,
        }));

        yield* Console.log(`[Witch] Used poison potion on ${target.getName()}`);
      }),

    // Skip heal (user chose not to use potion)
    skipHeal: Effect.gen(function* () {
      yield* Console.log('[Witch] Skipped heal potion');
    }),

    // Skip poison (user chose not to use potion)
    skipPoison: Effect.gen(function* () {
      yield* Console.log('[Witch] Skipped poison potion');
    }),

    // Reset state for new game
    reset: Effect.gen(function* () {
      yield* Ref.set(witchStateRef, {
        hasHealPotion: true,
        hasPoisonPotion: true,
      });
    }),
  } as const;
});

export class WitchService extends Effect.Service<WitchService>()(
  '@app/WitchService',
  {
    effect: make,
    dependencies: [Game.Default, DeathManager.Default],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
