import type { Role } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import { PlayerNotFoundError, SpecialPlayerNotFoundError } from './errors.js';
import { Lobby } from './Lobby.js';
import { initRolesList } from './role-assignment.js';

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

      getSpecialRolePlayer: Effect.fn('getSpecialRolePlayer')(function* (
        role: Role
      ) {
        return (
          specialRolePlayers.get(role) ??
          (yield* new SpecialPlayerNotFoundError({ role }))
        );
      }),
      getPlayerBySocketId: Effect.fn('getPlayerBySocketId')(function* (
        socketId: string
      ) {
        return (
          players.get(socketId) ??
          (yield* new PlayerNotFoundError({ socketId }))
        );
      }),

      setLovers: Effect.fn('setLovers')(function* (
        firstSid: string,
        secondSid: string
      ) {
        const first = players.get(firstSid);
        const second = players.get(secondSid);
        if (!(first && second)) {
          return yield* new PlayerNotFoundError({
            socketId: first ? secondSid : firstSid,
          });
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
    };
  }),
  dependencies: [Lobby.Default],
}) { }
