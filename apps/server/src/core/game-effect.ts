import type { Role } from '@repo/types';
import { Context, Effect, HashMap, Layer, Ref } from 'effect';
import { GameError } from '../Domain/GameError';
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
    readonly assignRoles: Effect.Effect<void, GameError>;
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

    const addPlayer = (name: string, sid: string) =>
      Ref.modify(playersRef, (players) => {
        const player = new Player(name, sid);
        return [player, HashMap.set(players, sid, player)] as const;
      });

    const getPlayerList = Ref.get(playersRef).pipe(
      Effect.map((players) => Array.from(HashMap.values(players)))
    );

    const getPlayerBySocketId = (sid: string) =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => {
          const result = HashMap.get(players, sid);
          return result._tag === 'Some' ? result.value : undefined;
        })
      );

    const initRolesList = Effect.gen(function* ($) {
      const players = yield* $(getPlayerList);
      const playerCount = players.length;
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
          roles.push('CUPID');
        }
        const remaining = playerCount - roles.length;
        for (let i = 0; i < remaining; i++) {
          roles.push('VILLAGER');
        }
      } else {
        for (let i = 0; i < playerCount; i++) {
          roles.push('VILLAGER');
        }
      }

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

    const assignRoles = Effect.gen(function* ($) {
      yield* $(initRolesList);
      const roles = yield* $(Ref.get(availableRolesRef));
      const shuffledRoles = shuffleArray(roles);
      const players = yield* $(getPlayerList);

      for (const player of players) {
        // Test cheat for Reda (copied from original)
        if (player.getName() === 'Reda') {
          const role: Role = 'HUNTER';
          player.assignRole(role);
          const index = shuffledRoles.indexOf(role);
          if (index > -1) {
            shuffledRoles.splice(index, 1);
          }
          yield* $(setPlayerTeams(player));
          yield* $(setSpecialRolePlayer(player));
          continue; // Continue outer loop
        }

        const role = shuffledRoles.pop();
        if (!role) {
          yield* $(
            Effect.fail(
              new GameError({ message: 'No roles available to assign' })
            )
          );
          return; // Should be unreachable given initRolesList logic but safe to handle
        }
        player.assignRole(role);
        yield* $(setSpecialRolePlayer(player));
        yield* $(setPlayerTeams(player));
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
      oldVote: string
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

    return {
      addPlayer,
      getPlayerList,
      assignRoles,
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
    };
  })
);
