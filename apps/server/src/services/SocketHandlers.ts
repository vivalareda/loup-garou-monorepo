import { Effect } from 'effect';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketServer } from './SocketServer.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    scoped: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const gameFlow = yield* GameFlow;
      const game = yield* Game;

      const gameShouldStart = () =>
        lobby.getPlayerCount.pipe(
          Effect.map((count) => count >= config.maxPlayers)
        );

      return {
        promptCupid: Effect.gen(function* () {
          const cupid = yield* game.getSpecialRolePlayer('CUPID');
          io.to(cupid.getSocketId()).emit('cupid:pick-required');
        }),
        setupHandlers: Effect.sync(() => {
          io.on('connection', (socket) => {
            socket.on('player:join', (name: string) => {
              Effect.gen(function* () {
                const player = yield* lobby.addPlayer(name, socket.id);
                yield* Effect.log(`adding new player ${player.name}`);

                socket.emit('lobby:player-data', player);
                socket.broadcast.emit('lobby:update-players-list', player);

                if (yield* gameShouldStart()) {
                  yield* Effect.log('starting game');
                  yield* gameFlow.startGame;
                }
              }).pipe(
                Effect.catchTags({
                  NameExists: () =>
                    Effect.sync(() => {
                      socket.emit('error', 'Name taken');
                    }),
                  LobbyFull: () =>
                    Effect.sync(() => {
                      socket.emit('error', 'Lobby full');
                    }),
                }),
                Effect.runPromise
              );
            });

            socket.on('disconnect', () => {
              console.log('Player disconnected:', socket.id);
            });
          });
        }),
      };
    }),
    dependencies: [
      SocketServer.Default,
      Lobby.Default,
      LobbyConfig.Live,
      GameFlow.Default,
      Game.Default,
    ],
  }
) { }
