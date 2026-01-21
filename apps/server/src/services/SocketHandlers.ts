import type { LobbyPlayer } from '@repo/types';
import { Effect } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { GameActions } from './GameActions.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SegmentExecution } from './SegmentExecution.js';
import { SocketServer } from './SocketServer.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    effect: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const game = yield* Game;
      const gameActions = yield* GameActions;
      const segmentExecution = yield* SegmentExecution;
      const deathManager = yield* DeathManager;

      let loversAlertClosed = 0;

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

            socket.on('lobby:get-players-list', () => {
              Effect.gen(function* () {
                const clientPlayerList = yield* game.getClientPlayerList;
                const lobbyPlayers: LobbyPlayer[] = clientPlayerList.map(
                  (p) => ({ ...p, type: 'lobby' as const })
                );
                socket.emit('lobby:players-list', lobbyPlayers);
              }).pipe(Effect.runPromise);
            });

            socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
              Effect.gen(function* () {
                yield* game.setLovers(selectedPlayers);
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('alert:lover-closed-alert', () => {
              Effect.gen(function* () {
                loversAlertClosed++;
                console.log('Lover alert closed:', loversAlertClosed);
                if (loversAlertClosed >= 2) {
                  loversAlertClosed = 0;
                  yield* segmentExecution.finishSegment;
                }
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('werewolf:player-voted', (targetPlayer: string) => {
              Effect.gen(function* () {
                yield* gameActions.handleWerewolfVote(socket.id, targetPlayer);
                const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
                if (hasAllAgreed) {
                  yield* segmentExecution.finishSegment;
                }
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on(
              'werewolf:player-update-vote',
              (targetPlayer: string, oldVote: string) => {
                Effect.gen(function* () {
                  yield* gameActions.handleWerewolfUpdateVote(
                    socket.id,
                    targetPlayer,
                    oldVote
                  );
                  const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
                  if (hasAllAgreed) {
                    yield* segmentExecution.finishSegment;
                  }
                })
                  .pipe(Effect.provideService(DeathManager, deathManager))
                  .pipe(Effect.runPromise);
              }
            );

            socket.on('witch:healed-player', () => {
              Effect.gen(function* () {
                yield* gameActions.healWerewolfVictim;
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('witch:poisoned-player', (playerSid: string) => {
              Effect.gen(function* () {
                yield* gameActions.witchKill(playerSid);
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-heal', () => {
              Effect.gen(function* () {
                console.log('Witch skipped heal action');
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-poison', () => {
              Effect.gen(function* () {
                console.log('Witch skipped poison action');
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('day:player-voted', (targetPlayer: string) => {
              Effect.gen(function* () {
                yield* gameActions.handleDayVote(socket.id, targetPlayer);
                const hasAllVoted = yield* game.hasAllPlayersVoted;
                if (hasAllVoted) {
                  yield* gameActions.processDayVoteResult;
                  const hunterInQueue = yield* game.hunterIsInDeathQueue;
                  if (hunterInQueue) {
                    yield* segmentExecution.runHunterSegment;
                  } else {
                    const loverInQueue =
                      yield* game.isOneOfLoversInDeathQueue;
                    if (loverInQueue) {
                      const isPartnerHunter = yield* game.isPartnerHunter;
                      if (isPartnerHunter) {
                        yield* segmentExecution.runHunterSegment;
                      } else {
                        yield* segmentExecution.runLoverSegment;
                      }
                    }
                  }
                  yield* segmentExecution.finishSegment;
                }
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('hunter:killed-player', (targetSid: string) => {
              Effect.gen(function* () {
                yield* gameActions.handleHunterPlayerPick(targetSid);
                yield* segmentExecution.continueDayAction;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:start-game', () => {
              Effect.gen(function* () {
                console.log('Admin starting game manually');
                const gamePlayers = yield* game.startGame;
                const clientPlayerList = yield* game.getClientPlayerList;
                for (const player of gamePlayers) {
                  io.to(player.getSocketId()).emit('player:role-assigned', player.role);
                }
                const lobbyPlayers: LobbyPlayer[] = clientPlayerList.map(
                  (p) => ({ ...p, type: 'lobby' as const })
                );
                socket.emit('lobby:villagers-list', lobbyPlayers);
                yield* segmentExecution.startGame;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:next-segment', () => {
              Effect.gen(function* () {
                console.log('Admin advancing to next segment');
                yield* segmentExecution.finishSegment;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on(
              'admin:simulate-werewolf-vote',
              (targetPlayer: string) => {
                Effect.gen(function* () {
                  console.log(
                    `Admin simulating werewolf vote for: ${targetPlayer}`
                  );
                  const werewolves = yield* game.getWerewolfList;
                  for (const werewolf of werewolves) {
                    yield* game.handleWerewolfVote(
                      werewolf.getSocketId(),
                      targetPlayer
                    );
                  }
                  yield* gameActions.broadcastWerewolfVotes;
                  const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
                  if (hasAllAgreed) {
                    yield* segmentExecution.finishSegment;
                  }
                })
                  .pipe(Effect.provideService(DeathManager, deathManager))
                  .pipe(Effect.runPromise);
              }
            );

            socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
              console.log(`Admin simulating day vote for: ${targetPlayer}`);
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
      GameActions.Default,
      SegmentExecution.Default,
      DeathManager.Default,
    ],
  }
) { }
