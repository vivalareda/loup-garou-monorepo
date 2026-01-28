import type { SegmentType } from '@repo/types';
import { Console, Effect } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketServer } from './SocketServer.js';
import { WerewolvesVote } from './WerewolvesVote.js';

export class SocketHandlers extends Effect.Service<SocketHandlers>()(
  '@app/SocketHandlers',
  {
    dependencies: [
      SocketServer.Default,
      Lobby.Default,
      LobbyConfig.Live,
      GameFlow.Default,
      Game.Default,
      WerewolvesVote.Default,
      DeathManager.Default,
    ],
    scoped: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const io = yield* SocketServer;
      const config = yield* LobbyConfig;
      const gameFlow = yield* GameFlow;
      const game = yield* Game;
      const werewolvesVotes = yield* WerewolvesVote;
      const deathManager = yield* DeathManager;

      let loversAlertCount = 0;

      const gameShouldStart = () =>
        lobby.getPlayerCount.pipe(
          Effect.map((count) => count >= config.maxPlayers)
        );

      const setupHandlers = Effect.sync(() => {
        io.on('connection', (socket) => {
          Effect.log(`new connection ${socket.id}`).pipe(Effect.runPromise);
          socket.on('player:join', (name: string) => {
            Effect.gen(function* () {
              const player = yield* lobby.addPlayer(name, socket.id);

              socket.emit('lobby:player-data', player);
              socket.broadcast.emit('lobby:update-players-list', player);
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

          const alertWerewolvesAboutVotes = Effect.fn(
            'alertWerewolvesAboutVotes'
          )(function* () {
            const voteData = yield* werewolvesVotes.getVotes;
            const werewolves = yield* game.getWerewolves;

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
            Effect.gen(function* () {
              const target = yield* werewolvesVotes.registerWerewolfVote(
                socket.id,
                victim
              );

              yield* alertWerewolvesAboutVotes();

              if (!target) {
                return;
              }

              yield* deathManager.addToPendingDeath('werewolves-kill', target);
              yield* werewolvesVotes.clear;
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          };

          socket.on('werewolf:player-voted', handleWerewolfVote);
          socket.on('werewolf:player-update-vote', handleWerewolfVote);

          socket.on('alert:lover-closed-alert', () => {
            Effect.gen(function* () {
              loversAlertCount++;
              if (loversAlertCount === 2) {
                yield* gameFlow.markSegmentAsSkipped('LOVERS');
                yield* gameFlow.finishSegment;
              }
            }).pipe(Effect.runPromise);
          });

          socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
            Effect.gen(function* () {
              yield* Effect.log('received cupids picks');
              yield* game.setLovers(selectedPlayers[0], selectedPlayers[1]);
              yield* gameFlow.markSegmentAsSkipped('CUPID');
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          });

          socket.on('lobby:start-game', () => {
            Effect.gen(function* () {
              if (yield* gameShouldStart()) {
                yield* Effect.log('starting game');
                yield* gameFlow.startGame;
              }
            }).pipe(Effect.runPromise);
          });

          socket.on('witch:healed-player', () => {
            Effect.gen(function* () {
              yield* Effect.log('witch healed');
              yield* deathManager.reviveWerewolfVictim;
              yield* game.witchUsedHeal;
              yield* gameFlow.markSegmentAsSkipped('WITCH_HEAL');
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          });

          socket.on('witch:skipped-heal', () => {
            Effect.gen(function* () {
              yield* Effect.log('witch did not heal');
              yield* deathManager.log;
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          });

          socket.on('witch:poisoned-player', (victim: string) => {
            Effect.gen(function* () {
              yield* Effect.log('adding victim to list');
              yield* deathManager.addToPendingDeath('witch-kill', victim);
              yield* gameFlow.finishSegment;
            }).pipe(Effect.runPromise);
          });

          socket.on('witch:skipped-poison', () => {
            gameFlow.finishSegment.pipe(Effect.runPromise);
          });

          socket.on(
            'lobby:start-mock',
            (
              segment: Exclude<
                SegmentType,
                'CUPID' | 'HUNTER' | 'DAY_VOTE' | 'WITCH_POISON'
              >
            ) => {
              Effect.gen(function* () {
                yield* Effect.log(`starting mock segment ${segment}`);
                if (
                  !(
                    segment === 'WEREWOLF' ||
                    segment === 'LOVERS' ||
                    segment === 'WITCH_HEAL'
                  )
                ) {
                  yield* Effect.log(`add segment ${segment} functionnality`);
                }
                yield* gameFlow.loadMockScenario(segment);
              }).pipe(
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
