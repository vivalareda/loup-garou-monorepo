import { Effect, Layer } from 'effect';
import { LobbyPlayer } from '../core/LobbyPlayer.js';
import { LobbyFullError, NameExistsError } from './errors.js';
import { LobbyConfig } from './LobbyConfig.js';

const make = Effect.gen(function* () {
  const config = yield* LobbyConfig;
  // console.log('Lobby Config:', config);
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
});

export class Lobby extends Effect.Service<Lobby>()('@app/Lobby', {
  effect: make,
  dependencies: [LobbyConfig.Live],
}) {
  static readonly Test = Layer.effect(this, make);
}
