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

    const startGame = Effect.gen(function* () {
      const lobbyPlayers = yield* lobby.getAllPlayers;
      const roles = initRolesList(lobbyPlayers.length);

      for (const [index, lp] of lobbyPlayers.entries()) {
        const role = roles[index];
        const player = new Player(lp.name, lp.sid, role);
        players.set(player.getSocketId(), player);
        setSpecialRolePlayer(player, role);
      }
    });

    const getPlayers = Effect.sync(() => Array.from(players.values()));

    const getPlayerBySocketId = Effect.fn('getPlayerBySocketId')(function* (
      socketId: string
    ) {
      return (
        players.get(socketId) ?? (yield* new PlayerNotFoundError({ socketId }))
      );
    });

    const getClientPlayerList = Effect.sync(() =>
      Array.from(players.values()).map((player) => player.getIdentity())
    );

    const getSpecialRolePlayer = Effect.fn('getSpecialRolePlayer')(function* (
      role: Role
    ) {
      return (
        specialRolePlayers.get(role) ??
        (yield* new SpecialPlayerNotFoundError({ role }))
      );
    });

    const getCupid = Effect.gen(function* () {
      return yield* getSpecialRolePlayer('CUPID');
    });

    const getWitch = Effect.gen(function* () {
      return yield* getSpecialRolePlayer('WITCH');
    });

    const getSeer = Effect.gen(function* () {
      return yield* getSpecialRolePlayer('SEER');
    });

    const getHunter = Effect.gen(function* () {
      return yield* getSpecialRolePlayer('HUNTER');
    });

    const getWerewolves = Effect.sync(() =>
      Array.from(players.values()).filter((p) => p.getRole() === 'WEREWOLF')
    );

    const setLovers = Effect.fn('setLovers')(function* (
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
    });

    const getLovers = Effect.sync(() => lovers);

    const getPartner = (socketId: string) =>
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
      });

    const isPlayerLover = (socketId: string) =>
      Effect.sync(() => {
        if (!lovers) {
          return false;
        }
        const player = players.get(socketId);
        if (!player) {
          return false;
        }
        return lovers[0] === player || lovers[1] === player;
      });

    const isAnyLoverHunter = Effect.sync(
      () => lovers?.some((p) => p.getRole() === 'HUNTER') ?? false
    );

    return {
      startGame,
      getPlayers,
      getPlayerBySocketId,
      getClientPlayerList,
      getSpecialRolePlayer,
      getCupid,
      getWitch,
      getSeer,
      getHunter,
      getWerewolves,
      setLovers,
      getLovers,
      getPartner,
      isPlayerLover,
      isAnyLoverHunter,
    };
  }),
  dependencies: [Lobby.Default],
}) {}
