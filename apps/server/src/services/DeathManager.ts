import type { DeathCause, PendingDeath } from '@repo/types';
import { Data, Effect } from 'effect';
import type { Player } from '../core/player.js';

export class PlayerAlreadyDeadError extends Data.TaggedError(
  'PlayerAlreadyDeadError'
)<{
  socketId: string;
}> {}

export class DeathManager extends Effect.Service<DeathManager>()(
  '@app/DeathManager',
  {
    effect: Effect.gen(function* () {
      const pendingDeaths = new Map<string, PendingDeath>();
      const teamWerewolves: Player[] = [];
      const teamVillagers: Player[] = [];

      return {
        addTeamWerewolf: Effect.fn('DeathManager.addTeamWerewolf')(function* (
          player: Player
        ) {
          teamWerewolves.push(player);
        }),

        addTeamVillager: Effect.fn('DeathManager.addTeamVillager')(function* (
          player: Player
        ) {
          teamVillagers.push(player);
        }),

        getTeamWerewolves: Effect.fn('DeathManager.getTeamWerewolves')(
          function* () {
            return teamWerewolves;
          }
        ),

        getTeamVillagers: Effect.fn('DeathManager.getTeamVillagers')(
          function* () {
            return teamVillagers;
          }
        ),

        addPendingDeath: Effect.fn('DeathManager.addPendingDeath')(function* (
          socketId: string,
          cause: DeathCause,
          metadata?: PendingDeath['metadata']
        ) {
          const pendingDeath: PendingDeath = {
            playerId: socketId,
            cause,
            metadata,
          };
          pendingDeaths.set(socketId, pendingDeath);
        }),

        removePendingDeath: Effect.fn('DeathManager.removePendingDeath')(
          function* (socketId: string) {
            const death = pendingDeaths.get(socketId);
            if (death) {
              pendingDeaths.delete(socketId);
              return death;
            }
          }
        ),

        getPendingDeaths: Effect.fn('DeathManager.getPendingDeaths')(
          function* () {
            return Array.from(pendingDeaths.values());
          }
        ),

        clearPendingDeaths: Effect.fn('DeathManager.clearPendingDeaths')(
          function* () {
            pendingDeaths.clear();
          }
        ),

        isPendingDeath: Effect.fn('DeathManager.isPendingDeath')(function* (
          socketId: string
        ) {
          return pendingDeaths.has(socketId);
        }),

        healWerewolvesVictim: Effect.fn('DeathManager.healWerewolvesVictim')(
          function* () {
            for (const [playerId, death] of pendingDeaths.entries()) {
              if (death.cause === 'WEREWOLVES') {
                pendingDeaths.delete(playerId);
              }
            }
          }
        ),

        addPartnerSuicide: Effect.fn('DeathManager.addPartnerSuicide')(
          function* (partnerId: string, deadLoverId: string) {
            const pendingDeath: PendingDeath = {
              playerId: partnerId,
              cause: 'PARTNER_SUICIDE',
              metadata: { loverId: deadLoverId },
            };
            pendingDeaths.set(partnerId, pendingDeath);
          }
        ),

        addHunterRevenge: Effect.fn('DeathManager.addHunterRevenge')(function* (
          victimId: string,
          hunterId: string
        ) {
          const pendingDeath: PendingDeath = {
            playerId: victimId,
            cause: 'HUNTER_REVENGE',
            metadata: { hunterId },
          };
          pendingDeaths.set(victimId, pendingDeath);
        }),

        addDayVoteElimination: Effect.fn('DeathManager.addDayVoteElimination')(
          function* (victimId: string, voteCount: number) {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'DAY_VOTE',
              metadata: { voteCount },
            };
            pendingDeaths.set(victimId, pendingDeath);
          }
        ),

        addWitchPoison: Effect.fn('DeathManager.addWitchPoison')(function* (
          victimId: string
        ) {
          const pendingDeath: PendingDeath = {
            playerId: victimId,
            cause: 'WITCH_POISON',
          };
          pendingDeaths.set(victimId, pendingDeath);
        }),
      };
    }),
  }
) {}
