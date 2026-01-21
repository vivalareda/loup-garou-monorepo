import type { LobbyPlayer } from '@repo/types';
import { Effect } from 'effect';
import { DeathManager } from './death-manager.js';
import { Game } from './game.js';
import { GameActions } from './game-actions.js';
import { Lobby } from './lobby.js';
import { MockScenario } from './mock-scenario.js';
import { SegmentExecution } from './segment-execution.js';
import { SocketServer } from './socket-server.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    effect: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const game = yield* Game;
      const gameActions = yield* GameActions;
      const segmentExecution = yield* SegmentExecution;
      const deathManager = yield* DeathManager;
      const mockScenario = yield* MockScenario;

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
                    const loverInQueue = yield* game.isOneOfLoversInDeathQueue;
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
                  io.to(player.getSocketId()).emit(
                    'player:role-assigned',
                    player.role
                  );
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
              Effect.gen(function* () {
                console.log(`Admin simulating day vote for: ${targetPlayer}`);
                const players = yield* game.getPlayers;
                const voters = players.filter((p) => p.role !== 'WEREWOLF');

                if (voters.length === 0) {
                  return yield* Effect.void;
                }

                for (const voter of voters) {
                  yield* gameActions.handleDayVote(
                    voter.socketId,
                    targetPlayer
                  );
                }

                const hasAllVoted = yield* game.hasAllPlayersVoted;
                if (hasAllVoted) {
                  yield* gameActions.processDayVoteResult;
                  const hunterInQueue = yield* game.hunterIsInDeathQueue;
                  if (hunterInQueue) {
                    yield* segmentExecution.runHunterSegment;
                  } else {
                    const loverInQueue = yield* game.isOneOfLoversInDeathQueue;
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

            socket.on('admin:mock-hunter-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock hunter event');
                yield* mockScenario.runWerewolfKillHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-lover-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock lover event');
                yield* mockScenario.runWerewolfKillLover;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-lover-second-hunter-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock lover second hunter event');
                yield* mockScenario.runWerewolfKillLoverSecondIsHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-lover-is-hunter-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock lover is hunter event');
                yield* mockScenario.runWerewolfKillLoverWhoIsHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-day-vote-hunter-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock day vote hunter event');
                yield* mockScenario.runDayVoteKillHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-day-vote-lover-event', () => {
              Effect.gen(function* () {
                console.log('Admin triggering mock day vote lover event');
                yield* mockScenario.runDayVoteKillLover;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-day-vote-lover-is-hunter-event', () => {
              Effect.gen(function* () {
                console.log(
                  'Admin triggering mock day vote lover is hunter event'
                );
                yield* mockScenario.runDayVoteKillLoverWhoIsHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
            });

            socket.on('admin:mock-day-vote-lover-second-hunter-event', () => {
              Effect.gen(function* () {
                console.log(
                  'Admin triggering mock day vote lover second hunter event'
                );
                yield* mockScenario.runDayVoteKillLoverSecondIsHunter;
              })
                .pipe(Effect.provideService(DeathManager, deathManager))
                .pipe(Effect.runPromise);
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
      MockScenario.Default,
    ],
  }
) {}
