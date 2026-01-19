import type { Role } from '@repo/types';
import { Context, Effect, HashMap, Layer, Ref } from 'effect';
import { GameError } from '../Domain/game-error';
import { SocketService } from '../server/socket-effect';
import { DeathManagerService } from './death-manager-effect';
import { Player } from './player';

/**
 * Game Service definition
 */
export class GameService extends Context.Tag('GameService')<
  GameService,
  {
    readonly addPlayer: (name: string, sid: string) => Effect.Effect<Player>;
    readonly getPlayerList: Effect.Effect<Player[]>;
    // biome-ignore lint/suspicious/noExplicitAny: ClientPlayerList returns partial objects
    readonly getClientPlayerList: Effect.Effect<any[]>;
    readonly assignRoles: Effect.Effect<void, GameError>;
    readonly assignRandomRoles: Effect.Effect<void, GameError>;
    readonly alertPlayersOfRoles: Effect.Effect<void>;
    readonly getVillagersList: Effect.Effect<Player[]>;
    readonly setLovers: (
      selectedPlayers: string[]
    ) => Effect.Effect<void, GameError>;
    readonly getLovers: Effect.Effect<Player[]>;
    readonly getPlayerBySocketId: (
      sid: string
    ) => Effect.Effect<Player | undefined>;
    readonly isWerewolf: (sid: string) => Effect.Effect<boolean>;
    readonly hasPartner: (sid: string) => Effect.Effect<boolean>;
    readonly isPlayerLover: (player: Player) => Effect.Effect<boolean>;
    readonly getPartner: (player: Player) => Effect.Effect<Player | undefined>;
    readonly getSpecialRolePlayer: (
      role: Role
    ) => Effect.Effect<Player | undefined>;
    readonly initRolesList: Effect.Effect<void>;
    readonly getWerewolfList: Effect.Effect<Player[]>;
    readonly getWerewolfTarget: Effect.Effect<string | undefined>;
    readonly handleWerewolfVote: (
      sid: string,
      targetId: string
    ) => Effect.Effect<void>;
    readonly handleWerewolfUpdateVote: (
      sid: string,
      targetId: string,
      oldVote: string
    ) => Effect.Effect<void>;
    readonly getWerewolfVoteTallies: Effect.Effect<Record<string, number>>;
    readonly hasAllWerewolvesAgreed: Effect.Effect<boolean>;
    readonly handleAllWerewolvesAgree: Effect.Effect<void>;
    readonly handleDayVote: (
      voterSid: string,
      targetId: string
    ) => Effect.Effect<void>;
    readonly hasAllPlayersVoted: Effect.Effect<boolean>;
    readonly getDayVoteTarget: Effect.Effect<Player | undefined>;
    readonly killHunterRevenge: (targetSid: string) => Effect.Effect<void>;
    readonly isHunterInLove: Effect.Effect<void>;
    readonly addPendingDeath: (
      targetSid: string,
      cause: string
    ) => Effect.Effect<void>;
    readonly witchKill: (targetSid: string) => Effect.Effect<void>;
    readonly healWerewolfVictim: Effect.Effect<void>;
    readonly checkIfWinner: Effect.Effect<'villagers' | 'werewolves' | null>;
    readonly alertWinnersAndLosers: (
      winner: 'villagers' | 'werewolves'
    ) => Effect.Effect<void>;
  }
>() {}

/**
 * Live Game Implementation
 */
export const GameLive = Layer.effect(
  GameService,
  Effect.gen(function* (_) {
    // Dependencies
    const deathManager = yield* _(DeathManagerService);
    const socketService = yield* _(SocketService);

    // State
    const playersRef = yield* _(Ref.make(HashMap.empty<string, Player>()));
    const loversRef = yield* _(Ref.make<Player[]>([]));
    const specialRolePlayersRef = yield* _(
      Ref.make(HashMap.empty<Role, Player>())
    );
    const availableRolesRef = yield* _(Ref.make<Role[]>([]));

    // Werewolf voting state
    const werewolfVotesRef = yield* _(
      Ref.make(HashMap.empty<string, string>())
    ); // voter -> target

    const dayVotesRef = yield* _(Ref.make(HashMap.empty<string, string>())); // voter -> target

    const addPlayer = (name: string, sid: string) =>
      Ref.modify(playersRef, (players) => {
        const player = new Player(name, sid);
        return [player, HashMap.set(players, sid, player)] as const;
      });

    const getPlayerList = Ref.get(playersRef).pipe(
      Effect.map((players) => Array.from(HashMap.values(players)))
    );

    const getClientPlayerList = getPlayerList.pipe(
      Effect.map((players) => players.map((p) => p.getPlayerForClient()))
    );

    const getVillagersList = getPlayerList.pipe(
      Effect.map((players) => players.filter((p) => p.getRole() !== 'WEREWOLF'))
    );

    const getPlayerBySocketId = (sid: string) =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const result = HashMap.get(players, sid);
          return result._tag === 'Some' ? result.value : undefined;
        })
      );

    const calculateRoleDistribution = (playerCount: number): Role[] => {
      const roles: Role[] = [];
      if (playerCount < 4) {
        for (let i = 0; i < playerCount; i++) {
          roles.push('VILLAGER');
        }
        return roles;
      }

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
        roles.push('CUPID');
      }
      const remaining = playerCount - roles.length;
      for (let i = 0; i < remaining; i++) {
        roles.push('VILLAGER');
      }
      return roles;
    };

    const initRolesList = Effect.gen(function* ($) {
      const players = yield* $(getPlayerList);
      const roles = calculateRoleDistribution(players.length);
      yield* $(Ref.set(availableRolesRef, roles));
    });

    const shuffleArray = <T>(array: T[]): T[] => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    };

    const setSpecialRolePlayer = (player: Player) =>
      Effect.gen(function* ($) {
        const role = player.getRole();
        if (role !== 'WEREWOLF' && role !== 'VILLAGER' && role) {
          yield* $(
            Ref.update(specialRolePlayersRef, (map) =>
              HashMap.set(map, role, player)
            )
          );
        }
      });

    const setPlayerTeams = (player: Player) =>
      Effect.gen(function* ($) {
        if (player.getRole() === 'WEREWOLF') {
          yield* $(deathManager.addTeamWerewolf(player));
        } else {
          yield* $(deathManager.addTeamVillager(player));
        }
      });

    const assignRedaRole = (
      player: Player,
      shuffledRoles: Role[],
      isRandom: boolean
    ) =>
      Effect.gen(function* ($) {
        if (!isRandom && player.getName() === 'Reda') {
          const role: Role = 'HUNTER';
          player.assignRole(role);
          const index = shuffledRoles.indexOf(role);
          if (index > -1) {
            shuffledRoles.splice(index, 1);
          }
          yield* $(setPlayerTeams(player));
          yield* $(setSpecialRolePlayer(player));
          return true;
        }
        return false;
      });

    const assignNormalRole = (player: Player, shuffledRoles: Role[]) =>
      Effect.gen(function* ($) {
        const role = shuffledRoles.pop();
        if (!role) {
          yield* $(
            Effect.fail(
              new GameError({ message: 'No roles available to assign' })
            )
          );
          return;
        }
        player.assignRole(role);
        yield* $(setSpecialRolePlayer(player));
        yield* $(setPlayerTeams(player));
      });

    const assignRolesInternal = (isRandom: boolean) =>
      Effect.gen(function* ($) {
        yield* $(initRolesList);
        const roles = yield* $(Ref.get(availableRolesRef));
        const shuffledRoles = shuffleArray(roles);
        const players = yield* $(getPlayerList);

        for (const player of players) {
          const assigned = yield* $(
            assignRedaRole(player, shuffledRoles, isRandom)
          );
          if (assigned) {
            continue;
          }
          yield* $(assignNormalRole(player, shuffledRoles));
        }
      });

    const assignRoles = assignRolesInternal(false);
    const assignRandomRoles = assignRolesInternal(true);

    const alertPlayersOfRoles = Effect.gen(function* ($) {
      const players = yield* $(getPlayerList);
      for (const player of players) {
        const role = player.getRole();
        if (role) {
          yield* $(
            socketService
              .to(player.getSocketId())
              .emit('player:role-assigned', role)
          );
        }
      }
    });

    const setLovers = (selectedPlayers: string[]) =>
      Effect.gen(function* ($) {
        const playersMap = yield* $(Ref.get(playersRef));
        const lovers: Player[] = [];

        for (const sid of selectedPlayers) {
          const result = HashMap.get(playersMap, sid);
          if (result._tag === 'None') {
            yield* $(
              Effect.fail(
                new GameError({ message: `Player with sid ${sid} not found` })
              )
            );
            return;
          }
          lovers.push(result.value);
        }
        yield* $(Ref.set(loversRef, lovers));
      });

    const getLovers = Ref.get(loversRef);

    const isWerewolf = (sid: string) =>
      Effect.gen(function* ($) {
        const player = yield* $(getPlayerBySocketId(sid));
        return player?.getRole() === 'WEREWOLF';
      });

    const hasPartner = (sid: string) =>
      Effect.gen(function* ($) {
        const lovers = yield* $(Ref.get(loversRef));
        return lovers.some((l) => l.getSocketId() === sid);
      });

    const isPlayerLover = (player: Player) =>
      Effect.gen(function* ($) {
        const lovers = yield* $(Ref.get(loversRef));
        return lovers.includes(player);
      });

    const getPartner = (player: Player) =>
      Effect.gen(function* ($) {
        const lovers = yield* $(Ref.get(loversRef));
        return lovers.find((l) => l.getSocketId() !== player.getSocketId());
      });

    const getSpecialRolePlayer = (role: Role) =>
      Ref.get(specialRolePlayersRef).pipe(
        Effect.map((map) => {
          const res = HashMap.get(map, role);
          return res._tag === 'Some' ? res.value : undefined;
        })
      );

    const getWerewolfList = Effect.gen(function* ($) {
      const players = yield* $(getPlayerList);
      return players.filter((p) => p.getRole() === 'WEREWOLF');
    });

    const handleWerewolfVote = (sid: string, targetId: string) =>
      Ref.update(werewolfVotesRef, (votes) =>
        HashMap.set(votes, sid, targetId)
      );

    const handleWerewolfUpdateVote = (
      sid: string,
      targetId: string,
      _oldVote: string
    ) =>
      Ref.update(werewolfVotesRef, (votes) =>
        HashMap.set(votes, sid, targetId)
      );

    const getWerewolfVoteTallies = Ref.get(werewolfVotesRef).pipe(
      Effect.map((votes) => {
        const tally: Record<string, number> = {};
        for (const target of HashMap.values(votes)) {
          tally[target] = (tally[target] || 0) + 1;
        }
        return tally;
      })
    );

    const getWerewolfTarget = Effect.gen(function* ($) {
      const votes = yield* $(Ref.get(werewolfVotesRef));
      const tally: Record<string, number> = {};
      for (const target of HashMap.values(votes)) {
        tally[target] = (tally[target] || 0) + 1;
      }

      let maxVotes = 0;
      let selectedTarget: string | undefined;
      for (const [target, count] of Object.entries(tally)) {
        if (count > maxVotes) {
          maxVotes = count;
          selectedTarget = target;
        }
      }
      return selectedTarget;
    });

    const hasAllWerewolvesAgreed = Effect.gen(function* ($) {
      const _votes = yield* $(Ref.get(werewolfVotesRef));
      const tallies = yield* $(getWerewolfVoteTallies);
      const werewolves = yield* $(getWerewolfList);

      return (
        werewolves.length > 0 &&
        Object.keys(tallies).length === 1 &&
        Object.values(tallies)[0] === werewolves.length
      );
    });

    const handleAllWerewolvesAgree = Effect.gen(function* ($) {
      const victimId = yield* $(getWerewolfTarget);
      if (victimId) {
        const victim = yield* $(getPlayerBySocketId(victimId));
        if (victim) {
          yield* $(deathManager.addPendingDeath(victim, 'WEREWOLVES'));
        }
      }
    });

    const handleDayVote = (voterSid: string, targetId: string) =>
      Ref.update(dayVotesRef, (votes) =>
        HashMap.set(votes, voterSid, targetId)
      );

    const hasAllPlayersVoted = Effect.gen(function* ($) {
      const votes = yield* $(Ref.get(dayVotesRef));
      const players = yield* $(getPlayerList);
      // Simplified: alive players check needed?
      return HashMap.size(votes) === players.length;
    });

    const getDayVoteTarget = Effect.gen(function* ($) {
      const votes = yield* $(Ref.get(dayVotesRef));
      const tally: Record<string, number> = {};
      for (const target of HashMap.values(votes)) {
        tally[target] = (tally[target] || 0) + 1;
      }
      // Simple majority or max votes
      let maxVotes = 0;
      let selectedTarget: string | undefined;
      for (const [target, count] of Object.entries(tally)) {
        if (count > maxVotes) {
          maxVotes = count;
          selectedTarget = target;
        }
      }
      if (selectedTarget) {
        return yield* $(getPlayerBySocketId(selectedTarget));
      }
      return;
    });

    const killHunterRevenge = (targetSid: string) =>
      Effect.gen(function* ($) {
        yield* $(deathManager.addHunterRevenge(targetSid, 'HUNTER')); // placeholder ID
      });

    const isHunterInLove = Effect.void; // Placeholder logic

    const addPendingDeath = (targetSid: string, cause: string) =>
      Effect.gen(function* ($) {
        const player = yield* $(getPlayerBySocketId(targetSid));
        if (player) {
          // biome-ignore lint/suspicious/noExplicitAny: DeathManager expects specific cause type
          yield* $(deathManager.addPendingDeath(player, cause as any));
        }
      });

    const witchKill = (targetSid: string) =>
      Effect.gen(function* ($) {
        yield* $(deathManager.addWitchPoison(targetSid));
      });

    const healWerewolfVictim = deathManager.healWerewolvesVictim;

    const alertWinnersAndLosers = (winner: 'villagers' | 'werewolves') =>
      Effect.gen(function* ($) {
        if (winner === 'villagers') {
          const villagers = yield* $(deathManager.getTeamVillagers);
          for (const player of villagers) {
            yield* $(
              socketService.to(player.getSocketId()).emit('alert:player-won')
            );
          }
          yield* $(alertLosers('werewolves'));
        }

        if (winner === 'werewolves') {
          const werewolves = yield* $(deathManager.getTeamWerewolves);
          for (const player of werewolves) {
            yield* $(
              socketService.to(player.getSocketId()).emit('alert:player-won')
            );
          }
          yield* $(alertLosers('villagers')); // Opponents are villagers
        }
      });

    const alertLosers = (loser: 'villagers' | 'werewolves') =>
      Effect.gen(function* ($) {
        if (loser === 'villagers') {
          const villagers = yield* $(deathManager.getTeamVillagers);
          for (const player of villagers) {
            yield* $(
              socketService.to(player.getSocketId()).emit('alert:player-lost')
            );
          }
        }

        if (loser === 'werewolves') {
          const werewolves = yield* $(deathManager.getTeamWerewolves);
          for (const player of werewolves) {
            yield* $(
              socketService.to(player.getSocketId()).emit('alert:player-lost')
            );
          }
        }
      });

    const checkIfWinner = Effect.gen(function* ($) {
      const villagers = yield* $(deathManager.getTeamVillagers);
      const werewolves = yield* $(deathManager.getTeamWerewolves);

      const villagersAlive = villagers.filter((p) => p.isAlive);
      const werewolvesAlive = werewolves.filter((p) => p.isAlive);

      if (werewolvesAlive.length === 0) {
        return 'villagers' as const;
      }

      if (werewolvesAlive.length === 1 && villagersAlive.length === 1) {
        // Simple logic for now, omitting complex Witch scenarios
        return 'werewolves' as const;
      }

      return null;
    });

    return {
      addPlayer,
      getPlayerList,
      getClientPlayerList,
      assignRoles,
      assignRandomRoles,
      alertPlayersOfRoles,
      getVillagersList,
      setLovers,
      getLovers,
      getPlayerBySocketId,
      isWerewolf,
      hasPartner,
      isPlayerLover,
      getPartner,
      getSpecialRolePlayer,
      initRolesList,
      getWerewolfList,
      getWerewolfTarget,
      handleWerewolfVote,
      handleWerewolfUpdateVote,
      getWerewolfVoteTallies,
      hasAllWerewolvesAgreed,
      handleAllWerewolvesAgree,
      handleDayVote,
      hasAllPlayersVoted,
      getDayVoteTarget,
      killHunterRevenge,
      isHunterInLove,
      addPendingDeath,
      witchKill,
      healWerewolfVictim,
      checkIfWinner,
      alertWinnersAndLosers,
    };
  })
);
