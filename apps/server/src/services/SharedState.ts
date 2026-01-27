import type { DeathInfo, PendingDeath } from '@repo/types';
import { Effect } from 'effect';

export class SharedState extends Effect.Service<SharedState>()(
  '@app/SharedState',
  {
    effect: Effect.gen(function* () {
      const pendingDeaths = new Map<string, PendingDeath>();
      const deathInfos = new Map<string, DeathInfo>();

      return {
        addPendingDeath: Effect.sync((pendingDeath: PendingDeath) => {
          pendingDeaths.set(pendingDeath.playerId, pendingDeath);
          return pendingDeath;
        }),

        removePendingDeath: Effect.sync((playerId: string) => {
          const pendingDeath = pendingDeaths.get(playerId);
          if (!pendingDeath) {
            return undefined;
          }
          pendingDeaths.delete(playerId);
          return pendingDeath;
        }),

        listPendingDeaths: Effect.sync(() => Array.from(pendingDeaths.values())),

        clearPendingDeaths: Effect.sync(() => {
          pendingDeaths.clear();
        }),

        addDeathInfo: Effect.sync((deathInfo: DeathInfo) => {
          deathInfos.set(deathInfo.playerId, deathInfo);
          return deathInfo;
        }),

        removeDeathInfo: Effect.sync((playerId: string) => {
          const deathInfo = deathInfos.get(playerId);
          if (!deathInfo) {
            return undefined;
          }
          deathInfos.delete(playerId);
          return deathInfo;
        }),

        listDeathInfos: Effect.sync(() => Array.from(deathInfos.values())),

        clearDeathInfos: Effect.sync(() => {
          deathInfos.clear();
        }),
      };
    }),
  }
) {}
