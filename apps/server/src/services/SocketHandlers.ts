import { Effect } from 'effect';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
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
      const gameFlow = yield* GameFlow;

      let loversAlertClosed = 0;

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
            // Player join event
            socket.on('player:join', (name: string) => {
              Effect.gen(function* () {
                const player = yield* lobby.addPlayer(name, socket.id);

                socket.emit('lobby:player-data', player);
                socket.broadcast.emit('lobby:update-players-list', player);

                if (yield* gameShouldStart()) {
                  yield* gameFlow.startGame;
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

            // Admin/Dashboard events for testing
            socket.on('admin:start-game', () => {
              Effect.gen(function* () {
                console.log('🎮 Admin starting game manually');
                yield* gameFlow.startGame;
              }).pipe(Effect.runPromise);
            });

            socket.on('admin:next-segment', () => {
              console.log('⏭ Admin advancing to next segment');
              // TODO: Implement segment manager integration
            });

            // Lobby getters
            socket.on('lobby:get-players-list', () => {
              Effect.gen(function* () {
                const players = yield* lobby.getAllPlayers;
                socket.emit('lobby:players-list', players);
              }).pipe(Effect.runPromise);
            });

            // Cupid events
            socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
              Effect.gen(function* () {
                if (selectedPlayers.length === 2) {
                  yield* game.setLovers(selectedPlayers[0], selectedPlayers[1]);
                  yield* gameFlow.continueAfterCupid;
                }
              }).pipe(Effect.runPromise);
            });

            // Lovers events
            socket.on('alert:lover-closed-alert', () => {
              loversAlertClosed++;
              console.log('alert received, current count ', loversAlertClosed);
              if (loversAlertClosed === 2) {
                Effect.gen(function* () {
                  yield* gameFlow.continueAfterLoversReveal;
                  loversAlertClosed = 0;
                }).pipe(Effect.runPromise);
              }
            });

            // Werewolf events
            socket.on('werewolf:player-voted', (targetPlayer: string) => {
              Effect.gen(function* () {
                yield* game.handleWerewolfVote(socket.id, targetPlayer);

                const allAgreed = yield* game.hasAllWerewolvesAgreed;
                if (allAgreed) {
                  yield* gameFlow.continueAfterWerewolfVote;
                }
              })
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Error handling werewolf vote:', error);
                      socket.emit('error', 'Failed to process werewolf vote');
                    })
                  )
                )
                .pipe(Effect.runPromise);
            });

            socket.on(
              'werewolf:player-update-vote',
              (targetPlayer: string, _oldVote: string) => {
                Effect.gen(function* () {
                  // For now, just handle as a new vote - update logic can be added later
                  yield* game.handleWerewolfVote(socket.id, targetPlayer);

                  const allAgreed = yield* game.hasAllWerewolvesAgreed;
                  if (allAgreed) {
                    yield* gameFlow.continueAfterWerewolfVote;
                  }
                })
                  .pipe(
                    Effect.catchAll((error) =>
                      Effect.sync(() => {
                        console.error('Error updating werewolf vote:', error);
                        socket.emit('error', 'Failed to update werewolf vote');
                      })
                    )
                  )
                  .pipe(Effect.runPromise);
              }
            );

            // Witch events
            socket.on('witch:healed-player', () => {
              Effect.gen(function* () {
                yield* game.witchHeal;
                yield* gameFlow.continueAfterWitchHeal;
              })
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Error handling witch heal:', error);
                      socket.emit('error', 'Failed to process witch heal');
                    })
                  )
                )
                .pipe(Effect.runPromise);
            });

            socket.on('witch:poisoned-player', (playerSid: string) => {
              Effect.gen(function* () {
                yield* game.witchPoison(playerSid);
                yield* gameFlow.continueAfterWitchPoison;
              })
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Error handling witch poison:', error);
                      socket.emit('error', 'Failed to process witch poison');
                    })
                  )
                )
                .pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-heal', () => {
              console.log('🧙 Witch skipped heal action');
              Effect.gen(function* () {
                yield* gameFlow.continueAfterWitchHeal;
              }).pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-poison', () => {
              console.log('🧙 Witch skipped poison action');
              Effect.gen(function* () {
                yield* gameFlow.continueAfterWitchPoison;
              }).pipe(Effect.runPromise);
            });

            // Day vote events
            socket.on('day:player-voted', (targetPlayer: string) => {
              Effect.gen(function* () {
                yield* game.handleDayVote(socket.id, targetPlayer);

                const allVoted = yield* game.hasAllPlayersVoted;
                if (allVoted) {
                  yield* gameFlow.continueAfterDayVote;
                }
              })
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Error handling day vote:', error);
                      socket.emit('error', 'Failed to process day vote');
                    })
                  )
                )
                .pipe(Effect.runPromise);
            });

            // Hunter events
            socket.on('hunter:killed-player', (targetSid: string) => {
              Effect.gen(function* () {
                yield* game.killPlayer(targetSid);
                yield* gameFlow.continueAfterHunterRevenge;
              })
                .pipe(
                  Effect.catchAll((error) =>
                    Effect.sync(() => {
                      console.error('Error handling hunter revenge:', error);
                      socket.emit('error', 'Failed to process hunter revenge');
                    })
                  )
                )
                .pipe(Effect.runPromise);
            });

            // Admin mock/simulation events
            socket.on('admin:simulate-werewolf-vote', (targetPlayer: string) => {
              console.log(`🐺 Admin simulating werewolf vote for: ${targetPlayer}`);
              Effect.gen(function* () {
                const players = yield* game.getPlayers;
                const werewolves = players.filter(p => p.getRole() === 'WEREWOLF');

                for (const werewolf of werewolves) {
                  yield* game.handleWerewolfVote(werewolf.getSocketId(), targetPlayer);
                }

                const allAgreed = yield* game.hasAllWerewolvesAgreed;
                if (allAgreed) {
                  yield* gameFlow.continueAfterWerewolfVote;
                }
              }).pipe(Effect.runPromise);
            });

            socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
              console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
              // TODO: Implement day vote simulation
            });

            socket.on('admin:mock-hunter-event', () => {
              console.log('🎭 Admin triggering mock hunter event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-lover-event', () => {
              console.log('🎭 Admin triggering mock lover event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-lover-second-hunter-event', () => {
              console.log('🎭 Admin triggering mock lover-second-hunter event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-lover-is-hunter-event', () => {
              console.log('🎭 Admin triggering mock lover-is-hunter event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-day-vote-hunter-event', () => {
              console.log('🎭 Admin triggering mock day-vote-hunter event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-day-vote-lover-event', () => {
              console.log('🎭 Admin triggering mock day-vote-lover event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-day-vote-lover-is-hunter-event', () => {
              console.log('🎭 Admin triggering mock day-vote-lover-is-hunter event');
              // TODO: Implement mock scenario
            });

            socket.on('admin:mock-day-vote-lover-second-hunter-event', () => {
              console.log('🎭 Admin triggering mock day-vote-lover-second-hunter event');
              // TODO: Implement mock scenario
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
      GameFlow.Default,
    ],
  }
) { }
