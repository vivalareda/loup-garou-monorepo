import type { SegmentType } from '@repo/types';
import { Console, Effect } from 'effect';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketAction } from './SocketAction.js';
import { SocketServer } from './SocketServer.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    dependencies: [
      SocketServer.Default,
      Lobby.Default,
      LobbyConfig.Live,
      Game.Default,
      SocketAction.Default,
    ],
    scoped: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const socketAction = yield* SocketAction;

      let loversAlertCount = 0;

      const gameShouldStart = () =>
        lobby.getPlayerCount.pipe(
          Effect.map((count) => count >= config.maxPlayers)
        );

      const setupHandlers = Effect.sync(() => {
        io.on('connection', (socket) => {
          Effect.log(`new connection ${socket.id}`).pipe(Effect.runPromise);
          socket.on('player:join', (name: string) => {
            socketAction.handlePlayerJoin(name, socket.id).pipe(
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
              Effect.andThen((player) => {
                if (player) {
                  socket.emit('lobby:player-data', player);
                  socket.broadcast.emit('lobby:update-players-list', player);
                }
              }),
              Effect.runPromise
            );
          });

          socket.on('lobby:get-players-list', () => {
            socketAction.handleGetPlayersList().pipe(
              Effect.andThen((players) => {
                socket.emit('lobby:players-list', players);
              }),
              Effect.runPromise
            );
          });

          const alertWerewolvesAboutVotes = Effect.fn(
            'alertWerewolvesAboutVotes'
          )(function* () {
            const { voteData, werewolves } =
              yield* socketAction.getAlertWerewolvesAboutVotes();

            Effect.sync(() => {
              for (const wolf of werewolves) {
                io.to(wolf.getSocketId()).emit(
                  'werewolf:current-votes',
                  voteData
                );
              }
            }).pipe(Effect.runSync);
          });

          const handleWerewolfVote = (victim: string) => {
            socketAction.handleWerewolfVote(socket.id, victim).pipe(
              Effect.andThen((result) => {
                if (result.shouldFinish) {
                  alertWerewolvesAboutVotes().pipe(Effect.runSync);
                }
              }),
              Effect.runPromise
            );
          };

          socket.on('werewolf:player-voted', handleWerewolfVote);
          socket.on('werewolf:player-update-vote', handleWerewolfVote);

          socket.on('alert:lover-closed-alert', () => {
            socketAction.handleLoverClosedAlert(loversAlertCount).pipe(
              Effect.andThen((newCount) => {
                loversAlertCount = newCount;
              }),
              Effect.runPromise
            );
          });

          socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
            socketAction
              .handleCupidLoversPick(selectedPlayers)
              .pipe(Effect.runPromise);
          });

          socket.on('lobby:start-game', () => {
            gameShouldStart().pipe(
              Effect.andThen((shouldStart) => {
                if (shouldStart) {
                  socketAction.handleStartGame().pipe(Effect.runPromise);
                }
              }),
              Effect.runPromise
            );
          });

          socket.on('witch:healed-player', () => {
            socketAction.handleWitchHeal().pipe(Effect.runPromise);
          });

          socket.on('witch:skipped-heal', () => {
            socketAction.handleWitchSkipHeal().pipe(Effect.runPromise);
          });

          socket.on('witch:poisoned-player', (victim: string) => {
            socketAction.handleWitchPoison(victim).pipe(Effect.runPromise);
          });

          socket.on('witch:skipped-poison', () => {
            socketAction.handleWitchSkipPoison().pipe(Effect.runPromise);
          });

          socket.on(
            'lobby:start-mock',
            (
              segment: Exclude<
                SegmentType,
                'CUPID' | 'HUNTER' | 'DAY_VOTE' | 'WITCH_POISON'
              >
            ) => {
              socketAction.handleStartMock(segment).pipe(
                Effect.catchAll((error) => Console.error(error)),
                Effect.runPromise
              );
            }
          );

          socket.on('disconnect', () => {
            Effect.log(`player disconnected ${socket.id}`).pipe(Effect.runSync);
          });
        });
      });

      return {
        setupHandlers,
      };
    }),
  }
) {}
