import type { DeathInfo, PendingDeath } from '@repo/types';
import type { Player } from '@/core/player.js';
import { Effect } from 'effect';
import {
  calculateDayVoteTallies,
  calculateWerewolfVoteTallies,
  getDayVoteTarget,
  getWerewolfTarget,
} from './vote-tallying.js';

export class SharedState extends Effect.Service<SharedState>()(
  '@app/SharedState',
  {
    effect: Effect.gen(function* () {
      const pendingDeaths = new Map<string, PendingDeath>();
      const deathInfos = new Map<string, DeathInfo>();
      const werewolfVotes = new Map<string, string>();
      const dayVotes = new Map<string, string>();
      let witchHasHealPotion = true;
      let witchHasPoisonPotion = true;

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

        canWitchHeal: Effect.sync(() => witchHasHealPotion),

        canWitchPoison: Effect.sync(() => witchHasPoisonPotion),

        useWitchHealPotion: Effect.sync(() => {
          witchHasHealPotion = false;
          return witchHasHealPotion;
        }),

        useWitchPoisonPotion: Effect.sync(() => {
          witchHasPoisonPotion = false;
          return witchHasPoisonPotion;
        }),

        resetWitchPotions: Effect.sync(() => {
          witchHasHealPotion = true;
          witchHasPoisonPotion = true;
        }),

        resetWitchPotionsOnDeath: Effect.sync(() => {
          witchHasHealPotion = false;
          witchHasPoisonPotion = false;
        }),

        setWerewolfVote: Effect.sync((voterSid: string, targetSid: string) => {
          werewolfVotes.set(voterSid, targetSid);
          return calculateWerewolfVoteTallies(werewolfVotes);
        }),

        updateWerewolfVote: Effect.sync(
          (voterSid: string, targetSid: string, oldTargetSid: string) => {
            const currentVote = werewolfVotes.get(voterSid);
            if (currentVote !== oldTargetSid) {
              throw new Error(
                `Vote mismatch: expected ${oldTargetSid}, but current vote is ${currentVote}`
              );
            }
            werewolfVotes.set(voterSid, targetSid);
            return calculateWerewolfVoteTallies(werewolfVotes);
          }
        ),

        getWerewolfVoteTallies: Effect.sync(() =>
          calculateWerewolfVoteTallies(werewolfVotes)
        ),

        getWerewolfTarget: Effect.sync((werewolfSids: string[]) =>
          getWerewolfTarget(werewolfVotes, werewolfSids)
        ),

        clearWerewolfVotes: Effect.sync(() => {
          werewolfVotes.clear();
        }),

        setDayVote: Effect.sync((voterSid: string, targetSid: string) => {
          dayVotes.set(voterSid, targetSid);
          return calculateDayVoteTallies(dayVotes);
        }),

        getDayVoteTallies: Effect.sync(() =>
          calculateDayVoteTallies(dayVotes)
        ),

        getDayVoteTarget: Effect.sync((players: Map<string, Player>) =>
          getDayVoteTarget(dayVotes, players)
        ),

        clearDayVotes: Effect.sync(() => {
          dayVotes.clear();
        }),
      };
    }),
  }
) {}
