import { Effect } from 'effect';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketServer } from './SocketServer.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    effect: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const game = yield* Game;

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

                socket.emit('lobby:player-data', player);
                socket.broadcast.emit('lobby:update-players-list', player);

                const count = yield* lobby.getPlayerCount;

                if (count >= config.maxPlayers) {
                  console.log();
                }
              })
                .pipe(
                  Effect.catchTags({
                    NameExists: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Name taken');
                      }),
                    LobbyFull: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Lobby full');
                      }),
                  })
                )
                .pipe(Effect.runPromise);
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
      Game.Default,
    ],
  }
) { }
