import type { Role } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '../core/player.js';
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

    const players = new Map<string, Player>();
    const specialRolePlayers = new Map<Role, Player>();
    let lovers: [Player, Player] | null = null;

    const setSpecialRolePlayer = (player: Player, role: Role) => {
      if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
        specialRolePlayers.set(role, player);
      }
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
      setLovers: (player1: Player, player2: Player) =>
        Effect.sync(() => {
          lovers = [player1, player2];
        }),
      getPartner: (player: Player) =>
        Effect.sync(() => {
          if (!lovers) {
            return;
          }
          if (lovers[0] === player) {
            return lovers[1];
          }
          if (lovers[1] === player) {
            return lovers[0];
          }
          return;
        }),
    };
  }),
  dependencies: [Lobby.Default],
}) {}
