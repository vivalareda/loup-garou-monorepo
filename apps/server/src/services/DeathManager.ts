import type { DeathCause, PendingDeath } from '@repo/types';
import { Effect } from 'effect';
import type { Player } from '@/core/player.js';

export class DeathManager extends Effect.Service<DeathManager>()(
  '@app/DeathManager',
  {
    effect: Effect.gen(function* () {
      const teamWerewolves: Player[] = [];
      const teamVillagers: Player[] = [];
      const pendingDeaths = new Map<string, PendingDeath>();

      return {
        addTeamWerewolf: (player: Player) =>
          Effect.sync(() => {
            teamWerewolves.push(player);
          }),

        addTeamVillager: (player: Player) =>
          Effect.sync(() => {
            teamVillagers.push(player);
          }),

        getTeamWerewolves: Effect.sync(() => teamWerewolves),

        getTeamVillagers: Effect.sync(() => teamVillagers),

        isInDeathQueue: (playerSid: string) =>
          Effect.sync(() => {
            return pendingDeaths.has(playerSid);
          }),

        addPendingDeath: (player: Player, cause: DeathCause = 'WEREWOLVES') =>
          Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: player.getSocketId(),
              cause,
            };
            pendingDeaths.set(player.getSocketId(), pendingDeath);
          }),

        removePendingDeath: (playerId: string) =>
          Effect.sync(() => {
            const pendingDeath = pendingDeaths.get(playerId);
            if (pendingDeath) {
              pendingDeaths.delete(playerId);
              return pendingDeath;
            }
          }),

        getPendingDeaths: Effect.sync(() => Array.from(pendingDeaths.values())),

        healWerewolvesVictim: Effect.sync(() => {
          for (const [playerId, death] of pendingDeaths.entries()) {
            if (death.cause === 'WEREWOLVES') {
              pendingDeaths.delete(playerId);
            }
          }
        }),

        addPartnerSuicide: (partnerId: string, deadLoverId: string) =>
          Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: partnerId,
              cause: 'PARTNER_SUICIDE',
              metadata: { loverId: deadLoverId },
            };
            pendingDeaths.set(partnerId, pendingDeath);
          }),

        addHunterRevenge: (victimId: string, hunterId: string) =>
          Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'HUNTER_REVENGE',
              metadata: { hunterId },
            };
            pendingDeaths.set(victimId, pendingDeath);
          }),

        addDayVoteElimination: (victimId: string, voteCount: number) =>
          Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'DAY_VOTE',
              metadata: { voteCount },
            };
            pendingDeaths.set(victimId, pendingDeath);
          }),

        addWitchPoison: (victimId: string) =>
          Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'WITCH_POISON',
            };
            pendingDeaths.set(victimId, pendingDeath);
          }),
      };
    }),
    dependencies: [],
  }
) {}
