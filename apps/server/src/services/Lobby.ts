import { Effect } from 'effect';
import { LobbyPlayer } from '@/core/LobbyPlayer.js';
import { LobbyFullError, NameExistsError } from './errors.js';
import { LobbyConfig } from './LobbyConfig.js';

export class Lobby extends Effect.Service<Lobby>()('@app/Lobby', {
  effect: Effect.gen(function* () {
    const config = yield* LobbyConfig;
    const players: LobbyPlayer[] = [];

    const isLobbyFull = () => players.length >= config.maxPlayers;
    const isNameTaken = (name: string) =>
      Array.from(players.values()).some((p) => p.name === name);

    return {
      addPlayer: (name: string, sid: string) =>
        Effect.gen(function* () {
          if (isNameTaken(name)) {
            return yield* Effect.fail(new NameExistsError());
          }

          if (isLobbyFull()) {
            return yield* Effect.fail(new LobbyFullError());
          }

          const player = new LobbyPlayer(name, sid);
          players.push(player);

          return player;
        }),

      getAllPlayers: Effect.sync(() => players),
      getPlayerCount: Effect.sync(() => players.length),
      isLobbyFull: Effect.sync(() => players.length >= config.maxPlayers),
      clear: Effect.sync(() => {
        players.length = 0;
      }),
    };
  }),
  dependencies: [],
}) {}
