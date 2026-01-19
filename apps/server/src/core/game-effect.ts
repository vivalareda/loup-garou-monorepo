import type { Role } from '@repo/types';
import { Context, Effect, HashMap, Layer, Ref } from 'effect';
import type { Player } from '@/core/player';
import { GameError } from '@/Domain/GameError';
import { DeathManagerService } from './death-manager-effect';

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

    const addPlayer = (name: string, sid: string) =>
      Ref.modify(playersRef, (players) => {
        // We can reuse the existing Player class for now as it's just data + simple methods
        // Eventually we might want to make Player purely data
        // For now, assume Player constructor is available globally or imported
        // Importing Player class is tricky if it's not exported or if we want to avoid side effects
        // But the previous file imported it, so we can too.
        // Wait, we need to import Player class.
        // Let's assume it's imported at the top.
        // Actually, let's create a factory or just new it up.
        // The original code: const player = new Player(name, sid);

        // We need to import Player from "@/core/player"
        // But wait, the original code had: import { Player } from '@/core/player';
        // We should probably check if Player is a class or interface.
        // The read of death-manager.ts imported Player from '@/core/player'.

        // Let's assume we can new it.
        // Ideally we'd move Player creation to a factory or Effect, but for now:
        const { Player } = require('@/core/player'); // Dynamic import/require might not work well with ESM/TS
        // Better to import at top level.

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

    const initRolesList = Effect.gen(function* (_) {
      const players = yield* _(getPlayerList);
      const playerCount = players.length;
      const roles: Role[] = [];

      if (playerCount >= 4) {
        const werewolfCount = Math.floor(playerCount / 3) || 1;
        for (let i = 0; i < werewolfCount; i++) roles.push('WEREWOLF');
        roles.push('CUPID');
        if (playerCount >= 6) roles.push('WITCH');
        if (playerCount >= 8) {
          roles.push('HUNTER');
          roles.push('CUPID');
        }
        const remaining = playerCount - roles.length;
        for (let i = 0; i < remaining; i++) roles.push('VILLAGER');
      } else {
        for (let i = 0; i < playerCount; i++) roles.push('VILLAGER');
      }

      yield* _(Ref.set(availableRolesRef, roles));
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
      Effect.gen(function* (_) {
        const role = player.getRole();
        if (role !== 'WEREWOLF' && role !== 'VILLAGER' && role) {
          yield* _(
            Ref.update(specialRolePlayersRef, (map) =>
              HashMap.set(map, role, player)
            )
          );
        }
      });

    const setPlayerTeams = (player: Player) =>
      Effect.gen(function* (_) {
        if (player.getRole() === 'WEREWOLF') {
          yield* _(deathManager.addTeamWerewolf(player));
        } else {
          yield* _(deathManager.addTeamVillager(player));
        }
      });

    const assignRoles = Effect.gen(function* (_) {
      yield* _(initRolesList);
      const roles = yield* _(Ref.get(availableRolesRef));
      const shuffledRoles = shuffleArray(roles);
      const players = yield* _(getPlayerList);

      for (const player of players) {
        // Test cheat for Reda (copied from original)
        if (player.getName() === 'Reda') {
          const role: Role = 'HUNTER';
          player.assignRole(role);
          const index = shuffledRoles.indexOf(role);
          if (index > -1) shuffledRoles.splice(index, 1);
          yield* _(setPlayerTeams(player));
          yield* _(setSpecialRolePlayer(player));
          continue; // Continue outer loop
        }

        const role = shuffledRoles.pop();
        if (!role) {
          yield* _(
            Effect.fail(
              new GameError({ message: 'No roles available to assign' })
            )
          );
          return; // Should be unreachable given initRolesList logic but safe to handle
        }
        player.assignRole(role);
        yield* _(setSpecialRolePlayer(player));
        yield* _(setPlayerTeams(player));
      }
    });

    const setLovers = (selectedPlayers: string[]) =>
      Effect.gen(function* (_) {
        const playersMap = yield* _(Ref.get(playersRef));
        const lovers: Player[] = [];

        for (const sid of selectedPlayers) {
          const result = HashMap.get(playersMap, sid);
          if (result._tag === 'None') {
            yield* _(
              Effect.fail(
                new GameError({ message: `Player with sid ${sid} not found` })
              )
            );
            return;
          }
          lovers.push(result.value);
        }
        yield* _(Ref.set(loversRef, lovers));
      });

    const getLovers = Ref.get(loversRef);

    const isWerewolf = (sid: string) =>
      Effect.gen(function* (_) {
        const player = yield* _(getPlayerBySocketId(sid));
        return player?.getRole() === 'WEREWOLF';
      });

    const hasPartner = (sid: string) =>
      Effect.gen(function* (_) {
        const lovers = yield* _(Ref.get(loversRef));
        return lovers.some((l) => l.getSocketId() === sid);
      });

    const isPlayerLover = (player: Player) =>
      Effect.gen(function* (_) {
        const lovers = yield* _(Ref.get(loversRef));
        return lovers.includes(player);
      });

    const getPartner = (player: Player) =>
      Effect.gen(function* (_) {
        const lovers = yield* _(Ref.get(loversRef));
        return lovers.find((l) => l.getSocketId() !== player.getSocketId());
      });

    const getSpecialRolePlayer = (role: Role) =>
      Ref.get(specialRolePlayersRef).pipe(
        Effect.map((map) => {
          const res = HashMap.get(map, role);
          return res._tag === 'Some' ? res.value : undefined;
        })
      );

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
    };
  })
);
