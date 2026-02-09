import type { SegmentType } from '@repo/types';
import { Console, Context, Effect, Layer } from 'effect';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { Lobby } from './Lobby.js';
import { LobbyConfig } from './LobbyConfig.js';
import { SocketAction } from './SocketAction.js';
import { SocketServer } from './SocketServer.js';

const makeSocketHandlers = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const io = yield* SocketServer;
  const config = yield* LobbyConfig;
  const socketAction = yield* SocketAction;
  const gameFlow = yield* GameFlow;

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

      const alertWerewolvesAboutVotes = Effect.fn('alertWerewolvesAboutVotes')(
        function* () {
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
        }
      );

      const alertVillageAboutVotes = Effect.fn('alertVillageAboutVotes')(
        function* () {
          const { voteData } = yield* socketAction.getAlertVillageAboutVotes();

          Effect.sync(() => {
            io.emit('day:current-votes', voteData);
          }).pipe(Effect.runSync);
        }
      );

      const handleWerewolfVote = (victim: string) => {
        gameFlow.completeWerewolfVote(victim).pipe(
          Effect.andThen(() => {
            alertWerewolvesAboutVotes().pipe(Effect.runSync);
          }),
          Effect.runPromise
        );
      };

      socket.on('werewolf:player-voted', handleWerewolfVote);
      socket.on('werewolf:player-update-vote', handleWerewolfVote);

      const handleDayVote = (victim: string) => {
        socketAction.handleDayVote(socket.id, victim).pipe(
          Effect.andThen((result) => {
            alertVillageAboutVotes().pipe(Effect.runSync);
            if (result.shouldFinish && result.target) {
              // Day vote completed
            }
          }),
          Effect.runPromise
        );
      };

      const handleDayVoteUpdate = (victim: string) => {
        socketAction.handleDayVoteUpdate(socket.id, victim).pipe(
          Effect.andThen((result) => {
            alertVillageAboutVotes().pipe(Effect.runSync);
            if (result.shouldFinish && result.target) {
              // Day vote completed
            }
          }),
          Effect.runPromise
        );
      };

      socket.on('day:player-voted', handleDayVote);
      socket.on('day:player-update-vote', handleDayVoteUpdate);

      socket.on('day:sheriff-pick', (target: string) => {
        socketAction
          .handleSheriffPick(socket.id, target)
          .pipe(Effect.runPromise);
      });

      socket.on('alert:lover-closed-alert', () => {
        socketAction.handleLoverClosedAlert(loversAlertCount).pipe(
          Effect.andThen((newCount) => {
            loversAlertCount = newCount;
          }),
          Effect.runPromise
        );
      });

      socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
        gameFlow
          .completeCupidSelection(selectedPlayers[0], selectedPlayers[1])
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
        gameFlow.completeWitchHeal(true).pipe(Effect.runPromise);
      });

      socket.on('witch:skipped-heal', () => {
        gameFlow.completeWitchHeal(false).pipe(Effect.runPromise);
      });

      socket.on('witch:poisoned-player', (victim: string) => {
        gameFlow.completeWitchPoison(victim).pipe(Effect.runPromise);
      });

      socket.on('witch:skipped-poison', () => {
        gameFlow.completeWitchPoison(null).pipe(Effect.runPromise);
      });

      socket.on('hunter:killed-player', (victim: string) => {
        socketAction.handleHunterKill(victim).pipe(Effect.runPromise);
      });

      socket.on('lobby:start-mock', (segment: SegmentType) => {
        socketAction.handleStartMock(segment).pipe(
          Effect.catchAll((error) => Console.error(error)),
          Effect.runPromise
        );
      });

      socket.on('disconnect', () => {
        Effect.log(`player disconnected ${socket.id}`).pipe(Effect.runSync);
      });
    });
  });

  return {
    setupHandlers,
  };
});

type SocketHandlersService = typeof makeSocketHandlers extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class SocketHandlers extends Context.Tag('@app/SocketHandlers')<
  SocketHandlers,
  SocketHandlersService
>() {
  static readonly DefaultWithoutDependencies = Layer.scoped(
    this,
    makeSocketHandlers
  );
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(SocketServer.Default),
    Layer.provide(Lobby.Default),
    Layer.provide(LobbyConfig.Live),
    Layer.provide(Game.Default),
    Layer.provide(SocketAction.Default),
    Layer.provide(GameFlow.Default)
  );
}
