import type { DeathCause } from '@repo/types';
import { Effect } from 'effect';
import type { Player } from '@/core/player.js';
import { VictimNotFound } from './errors.js';
import { Game } from './Game.js';

export class DeathManager extends Effect.Service<DeathManager>()(
  '@app/DeathManager',
  {
    dependencies: [Game.Default],
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const pendingDeath: Map<DeathCause, Player> = new Map();

      const addToPendingDeath = Effect.fn('addToPendingDeath')(function* (
        reason: DeathCause,
        sid: string
      ) {
        const player = yield* game.getPlayerBySocketId(sid);
        pendingDeath.set(reason, player);
      });

      const getVictim = Effect.fn('getWerewolfVictim')(function* (
        reason: DeathCause
      ) {
        yield* Effect.log(pendingDeath);
        return (
          pendingDeath.get(reason) ?? (yield* new VictimNotFound({ reason }))
        );
      });

      const isPendingDeathEmpty = Effect.sync(() => pendingDeath.size === 0);

      const log = Effect.sync(() => {
        pendingDeath.forEach((v, k) => {
          console.log(`the player ${v.getName()} is ${k}`);
        });
      });

      const reviveWerewolfVictim = Effect.sync(() =>
        pendingDeath.delete('WEREWOLVES')
      );

      return {
        addToPendingDeath,
        getVictim,
        log,
        reviveWerewolfVictim,
        isPendingDeathEmpty,
      };
    }),
  }
) {}
