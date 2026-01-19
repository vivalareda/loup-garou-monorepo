import type { DeathCause, PendingDeath } from '@repo/types';
import { Context, Effect, HashMap, Layer, Ref } from 'effect';
import type { Player } from '@/core/player';

/**
 * Service definition for DeathManager
 */
// Revert to original type + tag definition which is standard in Effect
export class DeathManagerService extends Context.Tag('DeathManagerService')<
  DeathManagerService,
  {
    readonly addTeamWerewolf: (player: Player) => Effect.Effect<void>;
    readonly addTeamVillager: (player: Player) => Effect.Effect<void>;
    readonly getTeamWerewolves: Effect.Effect<Player[]>;
    readonly getTeamVillagers: Effect.Effect<Player[]>;
    readonly isInDeathQueue: (playerSid: string) => Effect.Effect<boolean>;
    readonly addPendingDeath: (
      player: Player,
      cause?: DeathCause
    ) => Effect.Effect<void>;
    readonly removePendingDeath: (
      playerId: string
    ) => Effect.Effect<PendingDeath | undefined>;
    readonly getPendingDeaths: Effect.Effect<PendingDeath[]>;
    readonly healWerewolvesVictim: Effect.Effect<void>;
    readonly addPartnerSuicide: (
      partnerId: string,
      deadLoverId: string
    ) => Effect.Effect<void>;
    readonly addHunterRevenge: (
      victimId: string,
      hunterId: string
    ) => Effect.Effect<void>;
    readonly addDayVoteElimination: (
      victimId: string,
      voteCount: number
    ) => Effect.Effect<void>;
    readonly addWitchPoison: (victimId: string) => Effect.Effect<void>;
  }
>() {}

/**
 * Live implementation of DeathManagerService
 */
export const DeathManagerLive = Layer.effect(
  DeathManagerService,
  Effect.gen(function* (_) {
    // State
    const teamWerewolvesRef = yield* _(Ref.make<Player[]>([]));
    const teamVillagersRef = yield* _(Ref.make<Player[]>([]));
    const pendingDeathsRef = yield* _(
      Ref.make(HashMap.empty<string, PendingDeath>())
    );

    const addTeamWerewolf = (player: Player) =>
      Ref.update(teamWerewolvesRef, (list) => [...list, player]);

    const addTeamVillager = (player: Player) =>
      Ref.update(teamVillagersRef, (list) => [...list, player]);

    const getTeamWerewolves = Ref.get(teamWerewolvesRef);
    const getTeamVillagers = Ref.get(teamVillagersRef);

    const isInDeathQueue = (playerSid: string) =>
      Ref.get(pendingDeathsRef).pipe(
        Effect.map((map) => {
          const deaths = Array.from(HashMap.values(map));
          console.log(
            `checking if sid ${playerSid} in in map ${JSON.stringify(deaths)}`
          );
          return HashMap.has(map, playerSid);
        })
      );

    const addPendingDeath = (
      player: Player,
      cause: DeathCause = 'WEREWOLVES'
    ) =>
      Ref.update(pendingDeathsRef, (map) => {
        const pendingDeath: PendingDeath = {
          playerId: player.getSocketId(),
          cause,
        };
        return HashMap.set(map, player.getSocketId(), pendingDeath);
      });

    const removePendingDeath = (playerId: string) =>
      Ref.modify(pendingDeathsRef, (map) => {
        const pendingDeath = HashMap.get(map, playerId);
        if (pendingDeath._tag === 'Some') {
          return [pendingDeath.value, HashMap.remove(map, playerId)] as const;
        }
        return [undefined, map] as const;
      });

    const getPendingDeaths = Ref.get(pendingDeathsRef).pipe(
      Effect.map((map) => Array.from(HashMap.values(map)))
    );

    const healWerewolvesVictim = Ref.update(pendingDeathsRef, (map) => {
      let newMap = map;
      for (const [key, death] of HashMap.toEntries(map)) {
        if (death.cause === 'WEREWOLVES') {
          newMap = HashMap.remove(newMap, key);
        }
      }
      return newMap;
    });

    const addPartnerSuicide = (partnerId: string, deadLoverId: string) =>
      Ref.update(pendingDeathsRef, (map) => {
        const pendingDeath: PendingDeath = {
          playerId: partnerId,
          cause: 'PARTNER_SUICIDE',
          metadata: { loverId: deadLoverId },
        };
        return HashMap.set(map, partnerId, pendingDeath);
      });

    const addHunterRevenge = (victimId: string, hunterId: string) =>
      Ref.update(pendingDeathsRef, (map) => {
        const pendingDeath: PendingDeath = {
          playerId: victimId,
          cause: 'HUNTER_REVENGE',
          metadata: { hunterId },
        };
        return HashMap.set(map, victimId, pendingDeath);
      });

    const addDayVoteElimination = (victimId: string, voteCount: number) =>
      Ref.update(pendingDeathsRef, (map) => {
        const pendingDeath: PendingDeath = {
          playerId: victimId,
          cause: 'DAY_VOTE',
          metadata: { voteCount },
        };
        return HashMap.set(map, victimId, pendingDeath);
      });

    const addWitchPoison = (victimId: string) =>
      Ref.update(pendingDeathsRef, (map) => {
        const pendingDeath: PendingDeath = {
          playerId: victimId,
          cause: 'WITCH_POISON',
        };
        return HashMap.set(map, victimId, pendingDeath);
      });

    return {
      addTeamWerewolf,
      addTeamVillager,
      getTeamWerewolves,
      getTeamVillagers,
      isInDeathQueue,
      addPendingDeath,
      removePendingDeath,
      getPendingDeaths,
      healWerewolvesVictim,
      addPartnerSuicide,
      addHunterRevenge,
      addDayVoteElimination,
      addWitchPoison,
    };
  })
);
