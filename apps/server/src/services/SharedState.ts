import type { DeathInfo, PendingDeath } from '@repo/types';
import type { Player } from '@/core/player.js';
import { Effect } from 'effect';
import { checkIfWinner } from './win-conditions.js';
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
      let lovers: [string, string] | null = null;
      const assertWerewolfVoter = (
        players: Map<string, Player>,
        voterSid: string
      ) => {
        const voter = players.get(voterSid);
        if (voter?.getRole() !== 'WEREWOLF') {
          throw new Error(
            `Player ${voterSid} is not a werewolf and cannot vote during werewolf phase`
          );
        }
      };
      const assertNonWerewolfTarget = (
        players: Map<string, Player>,
        targetSid: string
      ) => {
        const target = players.get(targetSid);
        if (target?.getRole() === 'WEREWOLF') {
          throw new Error(
            `Target ${targetSid} is not a valid target (cannot vote for werewolves)`
          );
        }
      };

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

        setWerewolfVote: Effect.sync(
          (voterSid: string, targetSid: string, players: Map<string, Player>) => {
            assertWerewolfVoter(players, voterSid);
            assertNonWerewolfTarget(players, targetSid);
            werewolfVotes.set(voterSid, targetSid);
            return calculateWerewolfVoteTallies(werewolfVotes);
          }
        ),

        updateWerewolfVote: Effect.sync(
          (
            voterSid: string,
            targetSid: string,
            oldTargetSid: string,
            players: Map<string, Player>
          ) => {
            assertWerewolfVoter(players, voterSid);
            assertNonWerewolfTarget(players, targetSid);
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

        listAlivePlayers: Effect.sync((players: Player[]) =>
          players.filter((player) => player.isAlive)
        ),

        listAlivePlayerSids: Effect.sync((players: Player[]) =>
          players
            .filter((player) => player.isAlive)
            .map((player) => player.getSocketId())
        ),

        setLovers: Effect.sync((firstSid: string, secondSid: string) => {
          lovers = [firstSid, secondSid];
          return lovers;
        }),

        clearLovers: Effect.sync(() => {
          lovers = null;
        }),

        listLovers: Effect.sync(() => lovers),

        isPlayerLover: Effect.sync((playerSid: string) => {
          if (!lovers) {
            return false;
          }
          return lovers[0] === playerSid || lovers[1] === playerSid;
        }),

        getLoverPartner: Effect.sync(
          (players: Player[], playerSid: string) => {
            if (!lovers) {
              return null;
            }
            const [first, second] = lovers;
            if (playerSid !== first && playerSid !== second) {
              return null;
            }
            const partnerSid = playerSid === first ? second : first;
            return (
              players.find((player) => player.getSocketId() === partnerSid) ??
              null
            );
          }
        ),

        getHunter: Effect.sync((players: Player[]) =>
          players.find((player) => player.getRole() === 'HUNTER') ?? null
        ),

        isHunterAlive: Effect.sync((players: Player[]) => {
          const hunter = players.find((player) => player.getRole() === 'HUNTER');
          return hunter ? hunter.isAlive : false;
        }),

        isHunterInDeathQueue: Effect.sync((players: Player[]) => {
          const hunter = players.find((player) => player.getRole() === 'HUNTER');
          if (!hunter) {
            return false;
          }
          return pendingDeaths.has(hunter.getSocketId());
        }),

        checkForWinner: Effect.sync((players: Player[]) =>
          checkIfWinner(
            players,
            witchHasHealPotion,
            witchHasPoisonPotion
          )
        ),
      };
    }),
  }
) {}
