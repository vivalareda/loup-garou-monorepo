import { Effect, Layer } from 'effect';
import { Game } from './Game.js';

const make = Effect.gen(function* () {
  const game = yield* Game;

  return {
    _tag: '@app/SeerService' as const,

    // Check player role (returns the role)
    checkPlayer: (targetId: string) =>
      Effect.gen(function* () {
        const target = yield* game.getPlayerBySocketId(targetId);

        // Return role
        return target.getRole();
      }),
  };
});

export class SeerService extends Effect.Service<SeerService>()(
  '@app/SeerService',
  {
    effect: make,
    dependencies: [Game.Default],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
