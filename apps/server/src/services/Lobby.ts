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
      /**
       * Adds a new player to the lobby.
       * @param name - The player's display name.
       * @param sid - The socket ID of the player.
       * @returns Effect containing the created LobbyPlayer.
       * @throws NameExistsError - If a player with the given name already exists.
       * @throws LobbyFullError - If the lobby has reached the maximum player count.
       * @dependencies Depends on LobbyConfig for maxPlayers limit.
       */
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

      /**
       * Retrieves all players currently in the lobby.
       * @returns Effect containing an array of all LobbyPlayer instances.
       */
      getAllPlayers: Effect.sync(() => players),

      /**
       * Gets the current number of players in the lobby.
       * @returns Effect containing the player count.
       */
      getPlayerCount: Effect.sync(() => players.length),

      /**
       * Checks if the lobby has reached the maximum player capacity.
       * @returns Effect containing true if the lobby is full, false otherwise.
       * @dependencies Depends on LobbyConfig for maxPlayers limit.
       */
      isLobbyFull: Effect.sync(() => players.length >= config.maxPlayers),

      /**
       * Removes all players from the lobby, resetting it to an empty state.
       * @returns Effect that completes when the lobby is cleared.
       */
      clear: Effect.sync(() => {
        players.length = 0;
      }),
    };
  }),
  dependencies: [LobbyConfig.Live],
}) {}
