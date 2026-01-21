import { Effect } from 'effect';
import { Game } from './Game.js';

export class GamePhase extends Effect.Service<GamePhase>()('GamePhase', {
  effect: Effect.gen(function* () {
    return {
      playSegment: () => Effect.void,
    };
  }),
  dependencies: [Game.Default],
}) { }
