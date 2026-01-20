import type { Segment } from '@repo/types';
import { Effect, Layer, Ref } from 'effect';
import { GamePhase } from './GamePhase.js';
import { SocketServer } from './SocketServer.js';

const make = Effect.gen(function* () {
  const gamePhase = yield* GamePhase;
  // const socketServer = yield* SocketServer;

  // Define segments order
  const segments: Segment[] = [
    { type: 'CUPID', skip: false },
    { type: 'LOVERS', skip: false },
    { type: 'WEREWOLF', skip: false },
    { type: 'WITCH-HEAL', skip: false },
    { type: 'WITCH-POISON', skip: false },
    { type: 'HUNTER', skip: false },
    { type: 'DAY', skip: false },
  ];

  const currentSegmentIndex = yield* Ref.make(0);

  return {
    _tag: '@app/SegmentsManager' as const,

    start: Effect.gen(function* () {
      yield* Ref.set(currentSegmentIndex, 0);
      const segment = segments[0];
      yield* gamePhase.playSegment(segment);
    }),

    next: Effect.gen(function* () {
      const index = yield* Ref.get(currentSegmentIndex);
      const nextIndex = (index + 1) % segments.length;
      yield* Ref.set(currentSegmentIndex, nextIndex);
      const segment = segments[nextIndex];
      yield* gamePhase.playSegment(segment);
    }),
  };
});

export class SegmentsManager extends Effect.Service<SegmentsManager>()(
  '@app/SegmentsManager',
  {
    effect: make,
    dependencies: [GamePhase.Default, SocketServer.Default],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
