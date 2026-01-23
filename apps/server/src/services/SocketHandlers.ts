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

      const setupHandlers = Effect.sync(() => {
        io.on('connection', (socket) => {
          socket.on('player:join', (name: string) => {
            Effect.gen(function* () {
              const player = yield* lobby.addPlayer(name, socket.id);

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

          socket.on('lobby:get-players-list', () => {
            game.getClientPlayerList.pipe(
              Effect.andThen((players) => {
                socket.emit('lobby:players-list', players);
              }),
              Effect.runPromise
            );
          });

          socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
            Effect.gen(function* () {
              yield* Effect.log('received cupids picks');
              yield* game.setLovers(selectedPlayers[0], selectedPlayers[1]);
              yield* gameFlow.markSegmentAsSkipped('CUPID');
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          });

          socket.on('disconnect', () => {
            Effect.log(`player disconnected ${socket.id}`).pipe(Effect.runSync);
          });
        });
      });

      return {
        setupHandlers,
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
) {}
