import type { DeathCause, DeathInfo, PendingDeath, Role } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import {
  InvalidVoteError,
  NoTargetError,
  PlayerNotFoundError,
  SpecialPlayerNotFoundError,
  TieVoteError,
} from './errors.js';
import { Lobby } from './Lobby.js';
import { initRolesList } from './role-assignment.js';
import {
  calculateTallies,
  checkForTie,
  getWerewolfTarget as getWerewolfTargetPure,
  getWinningTarget,
  hasAllVoted,
  hasAllWerewolvesAgreed as hasAllWerewolvesAgreedPure,
} from './vote-tallying.js';

export class Game extends Effect.Service<Game>()('@app/Game', {
  effect: Effect.gen(function* () {
    const lobby = yield* Lobby;
    const players = new Map<string, Player>();
    const specialRolePlayers = new Map<Role, Player>();
    let lovers: [Player, Player] | null = null;
    const werewolfVotes = new Map<string, string>(); // voterSid → targetSid
    const dayVotes = new Map<string, string>(); // voterSid → targetSid
    const pendingDeaths = new Map<string, PendingDeath>();
    let witchHasHealPotion = true;
    let witchHasPoisonPotion = true;

    const setSpecialRolePlayer = (player: Player, role: Role) => {
      if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
        specialRolePlayers.set(role, player);
      }
    };

    const getPartnerForPlayer = (player: Player) => {
      if (!lovers) {
        return null;
      }
      if (lovers[0] === player) {
        return lovers[1];
      }
      if (lovers[1] === player) {
        return lovers[0];
      }
      return null;
    };

    const isPlayerLover = (player: Player) => lovers?.includes(player) ?? false;

    const getPlayerOrFail = (socketId: string) =>
      Effect.gen(function* () {
        return (
          players.get(socketId) ??
          (yield* Effect.fail(new PlayerNotFoundError({ socketId })))
        );
      });

    const createDeathInfo = (pendingDeath: PendingDeath, player: Player) => {
      const baseInfo = {
        playerId: pendingDeath.playerId,
        playerName: player.getName(),
        cause: pendingDeath.cause,
        timestamp: new Date(),
      };

      if (pendingDeath.metadata) {
        return {
          ...baseInfo,
          metadata: pendingDeath.metadata,
        } satisfies DeathInfo;
      }

      return baseInfo satisfies DeathInfo;
    };

    const enqueuePartnerSuicide = (
      pendingDeath: PendingDeath,
      player: Player
    ) => {
      if (pendingDeath.cause === 'PARTNER_SUICIDE') {
        return;
      }

      const partner = getPartnerForPlayer(player);
      if (!partner?.isAlive) {
        return;
      }

      if (!pendingDeaths.has(partner.getSocketId())) {
        pendingDeaths.set(partner.getSocketId(), {
          playerId: partner.getSocketId(),
          cause: 'PARTNER_SUICIDE',
          metadata: { loverId: pendingDeath.playerId },
        });
      }
    };

    return {
      startGame: Effect.gen(function* () {
        const lobbyPlayers = yield* lobby.getAllPlayers;
        const roles = initRolesList(lobbyPlayers.length);

        lobbyPlayers.map((lp, index) => {
          const role = roles[index];
          const player = new Player(lp.name, lp.sid, role);
          players.set(player.getSocketId(), player);
          setSpecialRolePlayer(player, role);
          return player;
        });
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

      setLovers: (firstSid: string, secondSid: string) =>
        Effect.gen(function* () {
          const first = players.get(firstSid);
          const second = players.get(secondSid);
          if (!(first && second)) {
            return yield* Effect.fail(
              new PlayerNotFoundError({
                socketId: first ? secondSid : firstSid,
              })
            );
          }
          lovers = [first, second];
        }),

      getPartner: (socketId: string) =>
        Effect.sync(() => {
          if (!lovers) {
            return null;
          }
          const player = players.get(socketId);
          if (!player) {
            return null;
          }
          if (lovers[0] === player) {
            return lovers[1];
          }
          if (lovers[1] === player) {
            return lovers[0];
          }
          return null;
        }),

      isPlayerLover: (socketId: string) =>
        Effect.sync(() => {
          if (!lovers) {
            return false;
          }
          const player = players.get(socketId);
          if (!player) {
            return false;
          }
          return lovers[0] === player || lovers[1] === player;
        }),

      isAnyLoverHunter: () =>
        Effect.sync(
          () => lovers?.some((p) => p.getRole() === 'HUNTER') ?? false
        ),

      getLovers: () => Effect.sync(() => lovers),

      addPendingDeath: (socketId: string, cause: DeathCause) =>
        Effect.gen(function* () {
          const player = players.get(socketId);
          if (!player) {
            return yield* Effect.fail(new PlayerNotFoundError({ socketId }));
          }

          const pendingDeath: PendingDeath = {
            playerId: socketId,
            cause,
          };

          pendingDeaths.set(socketId, pendingDeath);
        }),

      isInDeathQueue: (socketId: string) =>
        Effect.sync(() => pendingDeaths.has(socketId)),

      hunterIsInDeathQueue: Effect.sync(() => {
        const hunter = specialRolePlayers.get('HUNTER');
        if (!hunter) {
          return false;
        }
        return pendingDeaths.has(hunter.getSocketId());
      }),

      killPlayer: (socketId: string) =>
        Effect.gen(function* () {
          const player = players.get(socketId);
          if (!player) {
            return yield* Effect.fail(new PlayerNotFoundError({ socketId }));
          }
          player.setIsAlive(false);
          if (player.getRole() === 'WITCH') {
            witchHasHealPotion = false;
            witchHasPoisonPotion = false;
          }
        }),

      canWitchHeal: Effect.sync(() => witchHasHealPotion),

      canWitchPoison: Effect.sync(() => witchHasPoisonPotion),

      witchHeal: Effect.sync(() => {
        if (!witchHasHealPotion) {
          return;
        }
        for (const [playerId, pendingDeath] of pendingDeaths.entries()) {
          if (pendingDeath.cause === 'WEREWOLVES') {
            pendingDeaths.delete(playerId);
          }
        }
        witchHasHealPotion = false;
      }),

      witchPoison: (socketId: string) =>
        Effect.gen(function* () {
          if (!witchHasPoisonPotion) {
            return;
          }
          yield* getPlayerOrFail(socketId);
          pendingDeaths.set(socketId, {
            playerId: socketId,
            cause: 'WITCH_POISON',
          });
          witchHasPoisonPotion = false;
        }),

      processPendingDeaths: Effect.gen(function* () {
        const initialDeaths = Array.from(pendingDeaths.values());

        for (const pendingDeath of initialDeaths) {
          const player = yield* getPlayerOrFail(pendingDeath.playerId);

          if (isPlayerLover(player)) {
            enqueuePartnerSuicide(pendingDeath, player);
          }
        }

        const allDeaths = Array.from(pendingDeaths.values());
        const deathInfos: DeathInfo[] = [];

        for (const pendingDeath of allDeaths) {
          const player = yield* getPlayerOrFail(pendingDeath.playerId);
          deathInfos.push(createDeathInfo(pendingDeath, player));
          player.setIsAlive(false);
          if (player.getRole() === 'WITCH') {
            witchHasHealPotion = false;
            witchHasPoisonPotion = false;
          }
          pendingDeaths.delete(pendingDeath.playerId);
        }

        return deathInfos;
      }),

      // Werewolf voting methods
      handleWerewolfVote: (voterSid: string, targetSid: string) =>
        Effect.gen(function* () {
          const voter = players.get(voterSid);
          if (!voter) {
            return yield* Effect.fail(
              new PlayerNotFoundError({ socketId: voterSid })
            );
          }

          if (voter.getRole() !== 'WEREWOLF') {
            return yield* Effect.fail(
              new InvalidVoteError({
                reason: `Player ${voterSid} is not a werewolf and cannot vote during werewolf phase`,
              })
            );
          }

          werewolfVotes.set(voterSid, targetSid);
        }),

      getWerewolfVoteTallies: Effect.sync(() =>
        calculateTallies(werewolfVotes)
      ),

      hasAllWerewolvesAgreed: Effect.gen(function* () {
        const werewolves = Array.from(players.values()).filter(
          (p) => p.getRole() === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((w) => w.getSocketId());
        return hasAllWerewolvesAgreedPure(werewolfVotes, werewolfSids);
      }),

      getWerewolfTarget: Effect.gen(function* () {
        const werewolves = Array.from(players.values()).filter(
          (p) => p.getRole() === 'WEREWOLF'
        );
        const werewolfSids = werewolves.map((w) => w.getSocketId());
        return getWerewolfTargetPure(werewolfVotes, werewolfSids);
      }),

      clearWerewolfVotes: Effect.sync(() => {
        werewolfVotes.clear();
      }),

      handleDayVote: (voterSid: string, targetSid: string) =>
        Effect.gen(function* () {
          const voter = players.get(voterSid);
          if (!voter) {
            return yield* Effect.fail(
              new PlayerNotFoundError({ socketId: voterSid })
            );
          }

          dayVotes.set(voterSid, targetSid);
        }),

      getDayVoteTallies: Effect.sync(() => calculateTallies(dayVotes)),

      hasAllPlayersVoted: Effect.sync(() => {
        const alivePlayers = Array.from(players.values()).filter(
          (player) => player.isAlive
        );
        const aliveSids = alivePlayers.map((player) => player.getSocketId());
        return hasAllVoted(aliveSids, dayVotes);
      }),

      getDayVoteTarget: Effect.gen(function* () {
        const tallies = calculateTallies(dayVotes);

        if (checkForTie(tallies)) {
          return yield* Effect.fail(new TieVoteError());
        }

        const targetSid = getWinningTarget(tallies);

        if (!targetSid) {
          return yield* Effect.fail(new NoTargetError());
        }

        const target = players.get(targetSid);

        if (!target) {
          return yield* Effect.fail(
            new PlayerNotFoundError({ socketId: targetSid })
          );
        }

        return target;
      }),

      clearDayVotes: Effect.sync(() => {
        dayVotes.clear();
      }),
    };
  }),
  dependencies: [Lobby.Default],
}) {}
