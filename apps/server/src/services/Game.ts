import type { DeathInfo, Role, WerewolvesVoteState } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import { DeathManager } from './DeathManager.js';
import { PlayerNotFoundError, SpecialPlayerNotFoundError } from './errors.js';
import { Lobby } from './Lobby.js';

function initRolesList(playerCount: number): Role[] {
  const roles: Role[] = [];

  if (playerCount >= 4) {
    const werewolfCount = Math.floor(playerCount / 3) || 1;

    for (let i = 0; i < werewolfCount; i++) {
      roles.push('WEREWOLF');
    }

    roles.push('CUPID');

    if (playerCount >= 6) {
      roles.push('WITCH');
    }

    if (playerCount >= 8) {
      roles.push('HUNTER');
    }

    const remainingSlots = playerCount - roles.length;
    for (let i = 0; i < remainingSlots; i++) {
      roles.push('VILLAGER');
    }
  } else {
    for (let i = 0; i < playerCount; i++) {
      roles.push('VILLAGER');
    }
  }

  return shuffleArray(roles);
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export class Game extends Effect.Service<Game>()('@app/Game', {
  effect: Effect.gen(function* () {
    const lobby = yield* Lobby;
    yield* DeathManager;

    const players = new Map<string, Player>();
    const specialRolePlayers = new Map<Role, Player>();
    const lovers: Player[] = [];
    const werewolfVotes = new Map<string, string>();
    const dayVotes = new Map<string, string>();
    let witchHasHealPotion = true;
    let witchHasPoisonPotion = true;

    const setSpecialRolePlayer = (player: Player, role: Role) => {
      if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
        specialRolePlayers.set(role, player);
      }
    };

    const isWerewolf = (socketId: string): boolean => {
      const player = players.get(socketId);
      return player?.role === 'WEREWOLF';
    };

    const isValidTarget = (targetSid: string): boolean => {
      const target = players.get(targetSid);
      return target?.role !== 'WEREWOLF';
    };

    return {
      startGame: Effect.gen(function* () {
        const lobbyPlayers = yield* lobby.getAllPlayers;
        const roles = initRolesList(lobbyPlayers.length);

        const gamePlayers = lobbyPlayers.map((lp, index) => {
          const role = roles[index];
          const player = new Player(lp.name, lp.sid, role);
          players.set(player.getSocketId(), player);
          setSpecialRolePlayer(player, role);
          return player;
        });

        yield* lobby.clear;

        return gamePlayers;
      }),

      getPlayers: Effect.sync(() => Array.from(players.values())),
      getClientPlayerList: Effect.sync(() =>
        Array.from(players.values()).map((player) => player.getIdentity())
      ),
      getSpecialRolePlayer: (role: Role) =>
        Effect.gen(function* () {
          return (
            specialRolePlayers.get(role) ??
            (yield* Effect.fail(new SpecialPlayerNotFoundError({ role })))
          );
        }),
      getPlayerBySocketId: (socketId: string) =>
        Effect.gen(function* () {
          return (
            players.get(socketId) ??
            (yield* Effect.fail(new PlayerNotFoundError({ socketId })))
          );
        }),

      setLovers: (selectedPlayers: string[]) =>
        Effect.gen(function* () {
          for (const sid of selectedPlayers) {
            const player = players.get(sid);
            if (!player) {
              return yield* Effect.fail(
                new Error(`Player with sid ${sid} not found`)
              );
            }
            lovers.push(player);
          }
        }),

      isPlayerLover: (socketId: string) =>
        Effect.sync(() => {
          return lovers.some((lover) => lover.socketId === socketId);
        }),

      getPartner: (socketId: string) =>
        Effect.sync(() => {
          return lovers.find(
            (lover) => lover.socketId !== socketId
          );
        }),

      isOneOfLoversInDeathQueue: Effect.gen(function* () {
        const deathManager = yield* DeathManager;
        for (const lover of lovers) {
          const inQueue = yield* deathManager.isInDeathQueue(lover.socketId);
          if (inQueue) {
            return true;
          }
        }
        return false;
      }),

      isAnyOfLoversHunter: Effect.sync(() => {
        return lovers.some((lover) => lover.role === 'HUNTER');
      }),

      hasPartner: (socketId: string) =>
        Effect.sync(() => {
          return lovers.some((lover) => lover.socketId === socketId);
        }),

      getLovers: Effect.sync(() => lovers),

      getWerewolfList: Effect.sync(() => {
        return Array.from(players.values()).filter(
          (player) => player.role === 'WEREWOLF'
        );
      }),

      handleWerewolfVote: (voterSid: string, targetSid: string) =>
        Effect.gen(function* () {
          if (!isWerewolf(voterSid)) {
            return yield* Effect.fail(
              new Error(
                `Player ${voterSid} is not a werewolf and cannot vote during werewolf phase`
              )
            );
          }

          werewolfVotes.set(voterSid, targetSid);
        }),

      handleWerewolfUpdateVote: (
        voterSid: string,
        newTargetSid: string,
        oldTargetSid: string
      ) =>
        Effect.gen(function* () {
          if (!isWerewolf(voterSid)) {
            return yield* Effect.fail(
              new Error(
                `Player ${voterSid} is not a werewolf and cannot update vote during werewolf phase`
              )
            );
          }

          if (!isValidTarget(newTargetSid)) {
            return yield* Effect.fail(
              new Error(
                `Target ${newTargetSid} is not a valid target (cannot vote for werewolves)`
              )
            );
          }

          const currentVote = werewolfVotes.get(voterSid);
          if (currentVote !== oldTargetSid) {
            return yield* Effect.fail(
              new Error(
                `Vote mismatch: expected ${oldTargetSid}, but current vote is ${currentVote}`
              )
            );
          }

          werewolfVotes.set(voterSid, newTargetSid);
        }),

      getWerewolfVoteTallies: Effect.sync<WerewolvesVoteState>(() => {
        const tallies: WerewolvesVoteState = {};

        for (const targetSid of werewolfVotes.values()) {
          tallies[targetSid] = (tallies[targetSid] || 0) + 1;
        }

        return tallies;
      }),

      hasAllWerewolvesAgreed: Effect.sync(() => {
        const werewolves = Array.from(players.values()).filter(
          (player) => player.role === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((werewolf) => werewolf.socketId);

        if (werewolfSids.length === 0) {
          return false;
        }

        const allVoted = werewolfSids.every((sid) => werewolfVotes.has(sid));
        if (!allVoted) {
          return false;
        }

        const votes = Array.from(werewolfVotes.values());
        const firstVote = votes[0];
        return votes.every((vote) => vote === firstVote);
      }),

      getWerewolfTarget: Effect.sync(() => {
        const werewolves = Array.from(players.values()).filter(
          (player) => player.role === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((werewolf) => werewolf.socketId);

        if (werewolfSids.length === 0) {
          return null;
        }

        const allVoted = werewolfSids.every((sid) => werewolfVotes.has(sid));
        if (!allVoted) {
          return null;
        }

        const tallies = Array.from(werewolfVotes.values());
        const firstVote = tallies[0];
        if (!tallies.every((vote) => vote === firstVote)) {
          return null;
        }

        const voteTallies: WerewolvesVoteState = {};
        for (const targetSid of werewolfVotes.values()) {
          voteTallies[targetSid] = (voteTallies[targetSid] || 0) + 1;
        }

        let maxVotes = 0;
        let targetSid: string | null = null;

        for (const [playerSid, votes] of Object.entries(voteTallies)) {
          if (votes > maxVotes) {
            maxVotes = votes;
            targetSid = playerSid;
          }
        }

        return targetSid;
      }),

      handleDayVote: (voterSid: string, targetSid: string) =>
        Effect.sync(() => {
          dayVotes.set(voterSid, targetSid);
        }),

      calculateDayVoteTallies: Effect.sync<Record<string, number>>(() => {
        const tallies: Record<string, number> = {};

        for (const targetSid of dayVotes.values()) {
          tallies[targetSid] = (tallies[targetSid] || 0) + 1;
        }

        return tallies;
      }),

      hasAllPlayersVoted: Effect.sync(() => {
        const alivePlayers = Array.from(players.values()).filter(
          (player) => player.isAlive
        );
        const alivePlayerSids = alivePlayers.map((p) => p.socketId);

        if (alivePlayerSids.length === 0 || dayVotes.size === 0) {
          return false;
        }

        return alivePlayerSids.every((sid) => dayVotes.has(sid));
      }),

      getDayVoteTarget: Effect.sync(() => {
        const tallies: Record<string, number> = {};

        for (const targetSid of dayVotes.values()) {
          tallies[targetSid] = (tallies[targetSid] || 0) + 1;
        }

        let maxVotes = 0;
        let targetSid: string | null = null;
        let tieCount = 0;

        for (const [playerSid, votes] of Object.entries(tallies)) {
          if (votes > maxVotes) {
            maxVotes = votes;
            targetSid = playerSid;
            tieCount = 1;
          } else if (votes === maxVotes && maxVotes > 0) {
            tieCount++;
          }
        }

        if (tieCount > 1) {
          return null;
        }

        return targetSid;
      }),

      // biome-ignore lint/correctness/noUnusedVariables: Complex two-pass death processing logic
      processPendingDeaths: Effect.gen(function* () {
        const deathManager = yield* DeathManager;
        const initialDeaths = yield* deathManager.getPendingDeaths;

        for (const pendingDeath of initialDeaths) {
          const player = players.get(pendingDeath.playerId);

          if (!player) {
            return yield* Effect.fail(
              new Error(
                `Player ${pendingDeath.playerId} not found in processPendingDeaths`
              )
            );
          }

          const isLover = lovers.some(
            (lover) => lover.getSocketId() === player.getSocketId()
          );

          if (isLover && pendingDeath.cause !== 'PARTNER_SUICIDE') {
            const partner = lovers.find(
              (lover) => lover.getSocketId() !== player.getSocketId()
            );
            if (
              partner?.isAlive &&
              !(yield* deathManager.isInDeathQueue(partner.getSocketId()))
            ) {
              yield* deathManager.addPartnerSuicide(
                partner.getSocketId(),
                pendingDeath.playerId
              );
            }
          }
        }

        const allDeaths = yield* deathManager.getPendingDeaths;
        const deathInfos: DeathInfo[] = [];

        for (const pendingDeath of allDeaths) {
          const player = players.get(pendingDeath.playerId);

          if (!player) {
            return yield* Effect.fail(
              new Error(
                `Player ${pendingDeath.playerId} not found in processPendingDeaths`
              )
            );
          }

          const deathInfo: DeathInfo = {
            playerId: pendingDeath.playerId,
            playerName: player.name,
            cause: pendingDeath.cause,
            timestamp: new Date(),
            ...(pendingDeath.metadata && { metadata: pendingDeath.metadata }),
          };

          deathInfos.push(deathInfo);
          player.setIsAlive(false);

          if (player.role === 'WITCH') {
            witchHasHealPotion = false;
            witchHasPoisonPotion = false;
          }

          yield* deathManager.removePendingDeath(pendingDeath.playerId);
        }

        return deathInfos;
      }),

      checkIfWinner: Effect.gen(function* () {
        const deathManager = yield* DeathManager;
        
        const teamVillagers = yield* deathManager.getTeamVillagers;
        const teamWerewolves = yield* deathManager.getTeamWerewolves;

        const villagers = teamVillagers.filter((p) => p.isAlive);
        const werewolves = teamWerewolves.filter((p) => p.isAlive);

        if (werewolves.length === 0) {
          return 'villagers';
        }

        if (werewolves.length === 1 && villagers.length === 1) {
          const lastVillager = villagers[0];
          if (
            lastVillager.role === 'WITCH' &&
            (witchHasHealPotion || witchHasPoisonPotion)
          ) {
            return null;
          }
          return 'werewolves';
        }

        return null;
      }),

      healWerewolfVictim: Effect.gen(function* () {
        const deathManager = yield* DeathManager;
        yield* deathManager.healWerewolvesVictim;
        witchHasHealPotion = false;
      }),

      witchKill: (playerSid: string) =>
        Effect.gen(function* () {
          const deathManager = yield* DeathManager;
          yield* deathManager.addWitchPoison(playerSid);
          witchHasPoisonPotion = false;
        }),

      canWitchHeal: Effect.sync(() => {
        return witchHasHealPotion;
      }),

      canWitchPoison: Effect.sync(() => {
        return witchHasPoisonPotion;
      }),

      killHunterRevenge: (targetSid: string) =>
        Effect.gen(function* () {
          const deathManager = yield* DeathManager;

          const hunter = specialRolePlayers.get('HUNTER');
          if (!hunter) {
            return yield* Effect.fail(
              new Error('Tried to kill hunter target but hunter player not found')
            );
          }

          const target = players.get(targetSid);
          if (!target) {
            return yield* Effect.fail(
              new Error(`Player with sid ${targetSid} not found`)
            );
          }

          yield* deathManager.addHunterRevenge(targetSid, hunter.socketId);
        }),

      isHunterInLove: Effect.gen(function* () {
        const deathManager = yield* DeathManager;

        const hunter = specialRolePlayers.get('HUNTER');
        if (!hunter) {
          return yield* Effect.void;
        }

        const isLover = lovers.some(
          (lover) => lover.socketId === hunter.socketId
        );

        if (isLover) {
          const lover = lovers.find(
            (l) => l.socketId !== hunter.socketId
          );
          if (
            lover?.isAlive &&
            !(yield* deathManager.isInDeathQueue(lover.socketId))
          ) {
            yield* deathManager.addPartnerSuicide(
              lover.socketId,
              hunter.socketId
            );
          }
        }
      }),

      hunterIsInDeathQueue: Effect.gen(function* () {
        const deathManager = yield* DeathManager;

        const hunter = specialRolePlayers.get('HUNTER');
        if (!hunter) {
          return false;
        }

        return yield* deathManager.isInDeathQueue(hunter.socketId);
      }),

      isPartnerHunter: Effect.gen(function* () {
        const deathManager = yield* DeathManager;

        for (const lover of lovers) {
          const inQueue = yield* deathManager.isInDeathQueue(lover.socketId);
          if (!inQueue) {
            return lover.role === 'HUNTER';
          }
        }

        return false;
      }),
    };
  }),
  dependencies: [Lobby.Default, DeathManager.Default],
}) {}
