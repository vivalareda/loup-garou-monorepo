import type { Segment } from '@repo/types';
import { Effect } from 'effect';
import { Game } from './Game.js';
import { SocketHandlers } from './SocketHandlers.js';

export class GamePhase extends Effect.Service<GamePhase>()('GamePhase', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const socket = yield* SocketHandlers;
    const currentIndex = 0;

    const segments: SegmentState[] = [
      { type: 'CUPID', skip: false },
      { type: 'LOVERS_REVEAL', skip: false },
      { type: 'WEREWOLF', skip: false },
      { type: 'WITCH', skip: false },
      { type: 'SEER', skip: false },
      { type: 'DAY_VOTE', skip: false },
    ];

    return {
      playSegment: () => 
    };
  }),
  dependencies: [Game.Default],
}) { }
