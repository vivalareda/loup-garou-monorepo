import type { MockScenario, Role } from '@repo/types';
import { Context, Effect, Layer } from 'effect';
import { Player } from '@/core/player.js';
import {
  LoversNullError,
  PlayerNotFoundError,
  SpecialPlayerNotFoundError,
} from './errors.js';
import { Lobby } from './Lobby.js';
import { initRolesList } from './role-assignment.js';

const makeGame = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const players = new Map<string, Player>();
  const specialRolePlayers = new Map<Role, Player>();
  const deadPlayers: Player[] = [];

  let witchCanHeal = true;
  let witchCanPoison = true;

  let lovers: [Player, Player] | null = null;
  let sheriffPlayerSid: string | null = null;

  const setSpecialRolePlayer = (player: Player, role: Role) => {
    if (!['WEREWOLF', 'VILLAGER'].includes(role)) {
      specialRolePlayers.set(role, player);
    }
  };

  const playerIsDead = (sid: string) =>
    Effect.sync(() => {
      const player = players.get(sid);
      if (player) {
        deadPlayers.push(player);
        players.delete(sid);
      }
    });

  const startGame = Effect.gen(function* () {
    const lobbyPlayers = yield* lobby.getAllPlayers;
    const roles = initRolesList(lobbyPlayers.length);

    for (const [index, lp] of lobbyPlayers.entries()) {
      const role = roles[index];
      const player = new Player(lp.name, lp.sid, role);
      players.set(player.getSocketId(), player);
      setSpecialRolePlayer(player, role);
    }
    yield* setSheriffPlayer;
  });

  const setSheriffPlayer = Effect.sync(() => {
    const random = Math.floor(Math.random() * players.size);
    sheriffPlayerSid = Array.from(players.keys())[random];
  });

  const getSheriffPlayer = Effect.sync(() => sheriffPlayerSid);

  const setPlayers = Effect.fn('setPlayers')(function* (
    mockScenario: MockScenario
  ) {
    players.clear();
    specialRolePlayers.clear();
    deadPlayers.length = 0;

    lovers = null;

    const lobbyPlayers = yield* lobby.getAllPlayers;
    const sortedLobbyPlayers = [...lobbyPlayers].sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    mockScenario.players.forEach((p, idx) => {
      const player = new Player(
        sortedLobbyPlayers[idx].name,
        sortedLobbyPlayers[idx].sid,
        p.role
      );
      players.set(player.getSocketId(), player);
      setSpecialRolePlayer(player, player.getRole());
    });

    // Ensure sheriff player is set for debug scenarios.
    const sheriffSlot = mockScenario.sheriffPlayerSlot;
    if (sheriffSlot !== undefined) {
      const sheriffLobbyPlayer = sortedLobbyPlayers[sheriffSlot];
      sheriffPlayerSid = sheriffLobbyPlayer?.sid ?? null;
    } else {
      // Deterministic fallback for scenarios that don't specify a sheriff player.
      sheriffPlayerSid = sortedLobbyPlayers[0]?.sid ?? null;
    }
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
  const getDeadPlayers = Effect.sync(() => deadPlayers);
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

  const isLover = (playerSid: string) =>
    Effect.sync(() => {
      return lovers
        ?.map((p) => p.getSocketId())
        .some((sid) => sid === playerSid);
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
    getSheriffPlayer,
    getPlayers,
    getDeadPlayers,
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
    playerIsDead,
    isLover,
  };
});

type GameService = typeof makeGame extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class Game extends Context.Tag('@app/Game')<Game, GameService>() {
  static readonly DefaultWithoutDependencies = Layer.effect(this, makeGame);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Lobby.Default)
  );
}
