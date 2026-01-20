import type { ServerToClientEvents } from '@repo/types';
import { Effect } from 'effect';
import { DayVoting } from './DayVoting.js';
import { Game } from './Game.js';
import { HunterService } from './HunterService.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketServer } from './SocketServer.js';
import { WerewolfVoting } from './WerewolfVoting.js';
import { WitchService } from './WitchService.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    effect: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const game = yield* Game;
      const hunterService = yield* HunterService;
      const dayVoting = yield* DayVoting;
      const werewolfVoting = yield* WerewolfVoting;
      const witchService = yield* WitchService;

      return {
        emit: <K extends keyof ServerToClientEvents>(
          event: K,
          ...args: Parameters<ServerToClientEvents[K]>
        ) =>
          Effect.sync(() => {
            io.io.emit(event, ...args);
          }),
        promptCupid: Effect.gen(function* () {
          const cupid = yield* game.getSpecialRolePlayer('CUPID');
          io.io.to(cupid.getSocketId()).emit('cupid:pick-required');
        }),
        setupHandlers: Effect.sync(() => {
          io.io.on('connection', (socket) => {
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

            socket.on('werewolf:player-voted', (targetId: string) => {
              Effect.gen(function* () {
                yield* werewolfVoting.handleVote(socket.id, targetId);
              })
                .pipe(
                  Effect.catchTags({
                    InvalidVoterError: (err) =>
                      Effect.sync(() => {
                        socket.emit('error', err.reason);
                      }),
                    InvalidVoteTargetError: (err) =>
                      Effect.sync(() => {
                        socket.emit('error', err.reason);
                      }),
                    PlayerNotFoundError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Player not found');
                      }),
                  })
                )
                .pipe(Effect.runPromise);
            });

            socket.on('witch:healed-player', () => {
              Effect.gen(function* () {
                yield* witchService.healPlayer;
              })
                .pipe(
                  Effect.catchTags({
                    WitchHasNoPotionError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'You have no heal potion left');
                      }),
                  })
                )
                .pipe(Effect.runPromise);
            });

            socket.on('witch:poisoned-player', (targetId: string) => {
              Effect.gen(function* () {
                yield* witchService.poisonPlayer(targetId);
              })
                .pipe(
                  Effect.catchTags({
                    WitchHasNoPotionError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'You have no poison potion left');
                      }),
                    InvalidWitchTargetError: (err) =>
                      Effect.sync(() => {
                        socket.emit('error', err.reason);
                      }),
                    PlayerNotFoundError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Player not found');
                      }),
                  })
                )
                .pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-heal', () => {
              witchService.skipHeal.pipe(Effect.runPromise);
            });

            socket.on('witch:skipped-poison', () => {
              witchService.skipPoison.pipe(Effect.runPromise);
            });

            socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
              Effect.gen(function* () {
                if (
                  !Array.isArray(selectedPlayers) ||
                  selectedPlayers.length !== 2
                ) {
                  console.error('Invalid lovers selection');
                  return;
                }

                const [p1Id, p2Id] = selectedPlayers;
                const player1 = yield* game.getPlayerBySocketId(p1Id);
                const player2 = yield* game.getPlayerBySocketId(p2Id);

                yield* game.setLovers(player1, player2);

                io.io
                  .to(player1.getSocketId())
                  .emit('alert:player-is-lover', player2.getName());
                io.io
                  .to(player2.getSocketId())
                  .emit('alert:player-is-lover', player1.getName());
              }).pipe(Effect.runPromise);
            });

            socket.on('hunter:killed-player', (selectedPlayer: string) => {
              Effect.gen(function* () {
                yield* hunterService.processRevenge(socket.id, selectedPlayer);
              })
                .pipe(
                  Effect.catchTags({
                    NotHunterError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'You are not the hunter');
                      }),
                    HunterAlreadyFiredError: () =>
                      Effect.sync(() => {
                        socket.emit(
                          'error',
                          'You have already used your revenge'
                        );
                      }),
                    HunterTargetSelfError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'You cannot shoot yourself');
                      }),
                    HunterTargetDeadError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'The target is already dead');
                      }),
                    PlayerNotFoundError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Player not found');
                      }),
                  })
                )
                .pipe(Effect.runPromise);
            });

            socket.on('day:vote', (targetId: string) => {
              Effect.gen(function* () {
                yield* dayVoting.handleVote(socket.id, targetId);
              })
                .pipe(
                  Effect.catchTags({
                    VotingClosedError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Voting is closed');
                      }),
                    InvalidVoterError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'You cannot vote');
                      }),
                    InvalidVoteTargetError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Invalid vote target');
                      }),
                    PlayerNotFoundError: () =>
                      Effect.sync(() => {
                        socket.emit('error', 'Player not found');
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
      HunterService.Default,
      DayVoting.Default,
      WerewolfVoting.Default,
      WitchService.Default,
    ],
  }
) {}
