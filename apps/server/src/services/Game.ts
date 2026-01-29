import type { MockScenario, Role } from '@repo/types';
import { Effect } from 'effect';
import { Player } from '@/core/player.js';
import {
  LoversNullError,
  PlayerNotFoundError,
  SpecialPlayerNotFoundError,
} from './errors.js';
import { Lobby } from './Lobby.js';
import { initRolesList } from './role-assignment.js';

export class Game extends Effect.Service<Game>()('@app/Game', {
  dependencies: [Lobby.Default],
  effect: Effect.gen(function* () {
    const lobby = yield* Lobby;
    const players = new Map<string, Player>();
    const specialRolePlayers = new Map<Role, Player>();

    let witchCanHeal = true;
    let witchCanPoison = true;

    let lovers: [Player, Player] | null = null;

    const setSpecialRolePlayer = (player: Player, role: Role) => {
      if (!['WEREWOLF', 'VILLAGER'].includes(role)) {
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

    const setPlayers = Effect.fn('setPlayers')(function* (
      mockScenario: MockScenario
    ) {
      const lobbyPlayers = yield* lobby.getAllPlayers;
      mockScenario.players.forEach((p, idx) => {
        const player = new Player(
          lobbyPlayers[idx].name,
          lobbyPlayers[idx].sid,
          p.role
        );
        players.set(player.getSocketId(), player);
        setSpecialRolePlayer(player, player.getRole());
      });
    });

    const canWitchPoison = Effect.sync(() => witchCanPoison);
    const canWitchHeal = Effect.sync(() => witchCanHeal);
    const witchUsedKill = Effect.sync(() => {
      witchCanPoison = false;
    });

    const witchUsedHeal = Effect.sync(() => {
      witchCanHeal = false;
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

    const getCupid = getSpecialRolePlayer('CUPID');
    const getWitch = getSpecialRolePlayer('WITCH');
    const getSeer = Effect.sync(() => getSpecialRolePlayer('SEER'));
    const getHunter = Effect.sync(() => getSpecialRolePlayer('HUNTER'));

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
          message: 'Error while trying to set lovers',
        });
      }

      lovers = [first, second];
    });

    const getLovers = Effect.sync(() => lovers).pipe(
      Effect.flatMap((ls) =>
        ls ? Effect.succeed(ls) : Effect.fail(new LoversNullError())
      )
    );

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
      setPlayers,
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
      canWitchKill: canWitchPoison,
      canWitchHeal,
      witchUsedKill,
      witchUsedHeal,
    };
  }),
}) {}
