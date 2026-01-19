import { Context, Effect, Layer, Ref } from 'effect';
import { GameService } from '@/core/game-effect';
import type { SocketError } from '@/Domain/socket-error';
import { SegmentsManagerService } from '@/segments/segments-manager-effect';
import { EventsActionsService } from '@/server/events-actions-effect';
import { SocketService } from '@/server/socket-effect';

export class GameEventsService extends Context.Tag('GameEventsService')<
  GameEventsService,
  {
    readonly setupSocketHandlers: Effect.Effect<void, SocketError>;
  }
>() {}

const MAX_PLAYERCOUNT = 6;

export const GameEventsLive = Layer.effect(
  GameEventsService,
  Effect.gen(function* (_) {
    const game = yield* _(GameService);
    const socketService = yield* _(SocketService);
    const segmentsManager = yield* _(SegmentsManagerService);
    const eventsActions = yield* _(EventsActionsService);

    // State for lovers alert count (replacing class property)
    const loversAlertClosedRef = yield* _(Ref.make(0));

    const setupSocketHandlers = Effect.gen(function* ($) {
      const io = yield* $(socketService.getServer);

      // We need to wrap the event listeners in Effect calls ideally,
      // but since socket.io is callback based, we bridge here.

      yield* $(
        Effect.sync(() => {
          io.on('connection', (socket) => {
            // --- Lobby Events ---
            socket.on('player:join', (name: string) => {
              Effect.runPromise(
                game.addPlayer(name, socket.id).pipe(
                  Effect.flatMap((player) =>
                    Effect.all(
                      [
                        socketService
                          .to(socket.id)
                          .emit(
                            'lobby:player-data',
                            player.getWaitingRoomData()
                          ),
                        socketService.emit(
                          'lobby:update-players-list',
                          player.getPlayerForClient()
                        ),
                      ],
                      { concurrency: 'unbounded' }
                    )
                  ),
                  Effect.flatMap(() => game.getPlayerList),
                  Effect.flatMap((players) =>
                    Effect.log(
                      `Player joined: ${name} (ID: ${socket.id}), player count: ${players.length}`
                    ).pipe(Effect.map(() => players))
                  ),
                  Effect.flatMap((players) => {
                    if (players.length >= MAX_PLAYERCOUNT) {
                      return game.assignRoles.pipe(
                        Effect.flatMap(() => game.alertPlayersOfRoles),
                        Effect.flatMap(() => game.getVillagersList),
                        Effect.flatMap((villagers) =>
                          socketService
                            .to(socket.id)
                            .emit('lobby:villagers-list', villagers)
                        ),
                        Effect.flatMap(() => segmentsManager.startGame)
                      );
                    }
                    return Effect.void;
                  }),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            socket.on('disconnect', () => {
              // TODO: Implement player removal logic if needed
              console.log('Player disconnected:', socket.id);
            });

            // --- Admin/Debug Events ---
            socket.on('admin:start-game', () => {
              Effect.runPromise(
                Effect.log('🎮 Admin starting game manually').pipe(
                  Effect.flatMap(() => game.assignRandomRoles),
                  Effect.flatMap(() => game.alertPlayersOfRoles),
                  Effect.flatMap(() => game.getVillagersList),
                  Effect.flatMap((villagers) =>
                    socketService
                      .to(socket.id)
                      .emit('lobby:villagers-list', villagers)
                  ),
                  Effect.flatMap(() => segmentsManager.startGame),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            socket.on('admin:next-segment', () => {
              Effect.runPromise(
                Effect.log('⏭ Admin advancing to next segment').pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            // --- Getter Events ---
            socket.on('lobby:get-players-list', () => {
              Effect.runPromise(
                game.getClientPlayerList.pipe(
                  Effect.flatMap((players) =>
                    socketService
                      .to(socket.id)
                      .emit('lobby:players-list', players)
                  ),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            // --- Cupid Events ---
            socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
              Effect.runPromise(
                game.setLovers(selectedPlayers).pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            // --- Lovers Events ---
            socket.on('alert:lover-closed-alert', () => {
              Effect.runPromise(
                Ref.updateAndGet(loversAlertClosedRef, (n) => n + 1).pipe(
                  Effect.flatMap((count) => {
                    if (count === 2) {
                      return segmentsManager.finishSegment;
                    }
                    return Effect.void;
                  }),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            // --- Werewolf Events ---
            socket.on('werewolf:player-voted', (targetPlayer: string) => {
              Effect.runPromise(
                eventsActions
                  .handleWerewolfVote(socket.id, targetPlayer)
                  .pipe(Effect.catchAll((err) => Effect.logError(err)))
              );
            });

            socket.on(
              'werewolf:player-update-vote',
              (targetPlayer: string, oldVote: string) => {
                Effect.runPromise(
                  game
                    .handleWerewolfUpdateVote(socket.id, targetPlayer, oldVote)
                    .pipe(
                      Effect.flatMap(() => game.hasAllWerewolvesAgreed),
                      Effect.flatMap((agreed) => {
                        if (agreed) {
                          return game.handleAllWerewolvesAgree.pipe(
                            Effect.flatMap(() => segmentsManager.finishSegment)
                          );
                        }
                        return Effect.void;
                      }),
                      Effect.catchAll((err) => Effect.logError(err))
                    )
                );
              }
            );

            // --- Witch Events ---
            socket.on('witch:healed-player', () => {
              Effect.runPromise(
                game.healWerewolfVictim.pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            socket.on('witch:poisoned-player', (playerSid: string) => {
              Effect.runPromise(
                game.witchKill(playerSid).pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            socket.on('witch:skipped-heal', () => {
              Effect.runPromise(
                Effect.log('🧙 Witch skipped heal action').pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            socket.on('witch:skipped-poison', () => {
              Effect.runPromise(
                Effect.log('🧙 Witch skipped poison action').pipe(
                  Effect.flatMap(() => segmentsManager.finishSegment),
                  Effect.catchAll((err) => Effect.logError(err))
                )
              );
            });

            // --- Day Vote Events ---
            socket.on('day:player-voted', (targetPlayer: string) => {
              Effect.runPromise(
                eventsActions
                  .handleDayVote(socket.id, targetPlayer)
                  .pipe(Effect.catchAll((err) => Effect.logError(err)))
              );
            });

            // --- Hunter Events ---
            socket.on('hunter:killed-player', (targetSid: string) => {
              Effect.runPromise(
                eventsActions
                  .handleHunterPlayerPick(targetSid)
                  .pipe(Effect.catchAll((err) => Effect.logError(err)))
              );
            });

            // --- Mock Events (Skipped for now, can be ported similarly if needed) ---
          });
        })
      );
    });

    return {
      setupSocketHandlers,
    };
  })
);
