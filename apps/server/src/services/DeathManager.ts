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
          yield* Effect.sync(() => {
            teamWerewolves.push(player);
          });
        }),

        addTeamVillager: Effect.fn('DeathManager.addTeamVillager')(function* (
          player: Player
        ) {
          yield* Effect.sync(() => {
            teamVillagers.push(player);
          });
        }),

        getTeamWerewolves: Effect.fn('DeathManager.getTeamWerewolves')(
          function* () {
            return yield* Effect.sync(() => teamWerewolves);
          }
        ),

        getTeamVillagers: Effect.fn('DeathManager.getTeamVillagers')(
          function* () {
            return yield* Effect.sync(() => teamVillagers);
          }
        ),

        addPendingDeath: Effect.fn('DeathManager.addPendingDeath')(function* (
          socketId: string,
          cause: DeathCause,
          metadata?: PendingDeath['metadata']
        ) {
          yield* Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: socketId,
              cause,
              metadata,
            };
            pendingDeaths.set(socketId, pendingDeath);
          });
        }),

        removePendingDeath: Effect.fn('DeathManager.removePendingDeath')(
          function* (socketId: string) {
            return yield* Effect.sync(() => {
              const death = pendingDeaths.get(socketId);
              if (death) {
                pendingDeaths.delete(socketId);
                return death;
              }
            });
          }
        ),

        getPendingDeaths: Effect.fn('DeathManager.getPendingDeaths')(
          function* () {
            return yield* Effect.sync(() => Array.from(pendingDeaths.values()));
          }
        ),

        clearPendingDeaths: Effect.fn('DeathManager.clearPendingDeaths')(
          function* () {
            yield* Effect.sync(() => {
              pendingDeaths.clear();
            });
          }
        ),

        isPendingDeath: Effect.fn('DeathManager.isPendingDeath')(function* (
          socketId: string
        ) {
          return yield* Effect.sync(() => pendingDeaths.has(socketId));
        }),

        healWerewolvesVictim: Effect.fn('DeathManager.healWerewolvesVictim')(
          function* () {
            yield* Effect.sync(() => {
              for (const [playerId, death] of pendingDeaths.entries()) {
                if (death.cause === 'WEREWOLVES') {
                  pendingDeaths.delete(playerId);
                }
              }
            });
          }
        ),

        addPartnerSuicide: Effect.fn('DeathManager.addPartnerSuicide')(
          function* (partnerId: string, deadLoverId: string) {
            yield* Effect.sync(() => {
              const pendingDeath: PendingDeath = {
                playerId: partnerId,
                cause: 'PARTNER_SUICIDE',
                metadata: { loverId: deadLoverId },
              };
              pendingDeaths.set(partnerId, pendingDeath);
            });
          }
        ),

        addHunterRevenge: Effect.fn('DeathManager.addHunterRevenge')(function* (
          victimId: string,
          hunterId: string
        ) {
          yield* Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'HUNTER_REVENGE',
              metadata: { hunterId },
            };
            pendingDeaths.set(victimId, pendingDeath);
          });
        }),

        addDayVoteElimination: Effect.fn('DeathManager.addDayVoteElimination')(
          function* (victimId: string, voteCount: number) {
            yield* Effect.sync(() => {
              const pendingDeath: PendingDeath = {
                playerId: victimId,
                cause: 'DAY_VOTE',
                metadata: { voteCount },
              };
              pendingDeaths.set(victimId, pendingDeath);
            });
          }
        ),

        addWitchPoison: Effect.fn('DeathManager.addWitchPoison')(function* (
          victimId: string
        ) {
          yield* Effect.sync(() => {
            const pendingDeath: PendingDeath = {
              playerId: victimId,
              cause: 'WITCH_POISON',
            };
            pendingDeaths.set(victimId, pendingDeath);
          });
        }),

        processDeaths: Effect.fn('DeathManager.processDeaths')(function* (
          getPartner: (
            playerId: string
          ) => Effect.Effect<string | undefined, unknown, unknown>
        ) {
          // Pass 1: Mark direct victims as dead
          const deaths = new Map<string, PendingDeath>();

          for (const [id, death] of pendingDeaths) {
            deaths.set(id, death);
            yield* Effect.log(
              `[DeathManager] Processing direct death: ${id} (${death.cause})`
            );
          }

          // Pass 2: Handle cascades (lovers)
          const directDeaths = Array.from(deaths.values());
          for (const death of directDeaths) {
            const partnerId = yield* getPartner(death.playerId);
            if (partnerId && !deaths.has(partnerId)) {
              const suicide: PendingDeath = {
                playerId: partnerId,
                cause: 'PARTNER_SUICIDE',
                metadata: { loverId: death.playerId },
              };
              deaths.set(partnerId, suicide);
              yield* Effect.log(
                `[DeathManager] Added cascade death (suicide): ${partnerId}`
              );
            }
          }

          // Clear pending deaths as they are now processed
          pendingDeaths.clear();

          // Mark players as dead in the team lists
          yield* Effect.sync(() => {
            for (const death of Array.from(deaths.values())) {
              const player =
                teamWerewolves.find((p) => p.socketId === death.playerId) ||
                teamVillagers.find((p) => p.socketId === death.playerId);
              if (player) {
                player.kill();
              }
            }
          });

          return Array.from(deaths.values());
        }),

        checkWinner: Effect.fn('DeathManager.checkWinner')(function* () {
          return yield* Effect.sync(() => {
            const aliveWerewolves = teamWerewolves.filter((p) => p.isAlive);
            const aliveVillagers = teamVillagers.filter((p) => p.isAlive);

            if (aliveWerewolves.length === 0) {
              return 'VILLAGERS' as const;
            }

            if (aliveWerewolves.length >= aliveVillagers.length) {
              return 'WEREWOLVES' as const;
            }

            return null;
          });
        }),
      };
    }),
  }
) {}
