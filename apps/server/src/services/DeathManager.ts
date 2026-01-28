import { Effect } from 'effect';
import type { Player } from '@/core/player.js';
import { VictimNotFound } from './errors.js';
import { Game } from './Game.js';

type Reason = 'werewolves-kill' | 'witch-kill';

export class DeathManager extends Effect.Service<DeathManager>()(
  '@app/DeathManager',
  {
    dependencies: [Game.Default],
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const pendingDeath: Map<Reason, Player> = new Map();

      const addToPendingDeath = Effect.fn('addToPendingDeath')(function* (
        reason: Reason,
        sid: string
      ) {
        const player = yield* game.getPlayerBySocketId(sid);
        pendingDeath.set(reason, player);
      });

      const getVictim = Effect.fn('getWerewolfVictim')(function* (
        reason: Reason
      ) {
        yield* Effect.log(pendingDeath);
        return (
          pendingDeath.get(reason) ?? (yield* new VictimNotFound({ reason }))
        );
      });

      const log = Effect.sync(() => {
        pendingDeath.forEach((v, k) => {
          console.log(`the player ${v.getName()} is ${k}`);
        });
      });

      const reviveWerewolfVictim = Effect.sync(() =>
        pendingDeath.delete('werewolves-kill')
      );

      return {
        addToPendingDeath,
        getVictim,
        log,
        reviveWerewolfVictim,
      };
    }),
  }
) {}
