import { Effect } from 'effect';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { Lobby } from './Lobby.js';
import { WerewolvesVote } from './WerewolvesVote.js';

export class SocketAction extends Effect.Service<SocketAction>()(
  'SocketAction',
  {
    dependencies: [
      Lobby.Default,
      Game.Default,
      GameFlow.Default,
      WerewolvesVote.Default,
      DeathManager.Default,
    ],
    effect: Effect.gen(function* () {
      const lobby = yield* Lobby;
      const game = yield* Game;
      const gameFlow = yield* GameFlow;
      const werewolvesVotes = yield* WerewolvesVote;
      const deathManager = yield* DeathManager;

      const handlePlayerJoin = Effect.fn('handlePlayerJoin')(function* (
        playerName: string,
        socketId: string
      ) {
        const player = yield* lobby.addPlayer(playerName, socketId);
        return player;
      });

      const handleGetPlayersList = Effect.fn('handleGetPlayersList')(
        function* () {
          const players = yield* game.getClientPlayerList;
          return players;
        }
      );

      const handleWerewolfVote = Effect.fn('handleWerewolfVote')(function* (
        socketId: string,
        victim: string
      ) {
        const target = yield* werewolvesVotes.registerWerewolfVote(
          socketId,
          victim
        );

        if (!target) {
          return { shouldFinish: false };
        }

        yield* deathManager.addToPendingDeath('WEREWOLVES', target);
        yield* werewolvesVotes.clear;
        yield* gameFlow.finishSegment;
        return { shouldFinish: true, target };
      });

      const handleLoverClosedAlert = Effect.fn('handleLoverClosedAlert')(
        function* (alertCount: number) {
          const newCount = alertCount + 1;
          if (newCount === 2) {
            yield* gameFlow.markSegmentAsSkipped('LOVERS');
            yield* gameFlow.finishSegment;
          }
          return newCount;
        }
      );

      const handleCupidLoversPick = Effect.fn('handleCupidLoversPick')(
        function* (selectedPlayers: string[]) {
          yield* Effect.log('received cupids picks');
          yield* game.setLovers(selectedPlayers[0], selectedPlayers[1]);
          yield* gameFlow.markSegmentAsSkipped('CUPID');
          yield* gameFlow.finishSegment;
        }
      );

      const handleWitchHeal = Effect.fn('handleWitchHeal')(function* () {
        yield* Effect.log('witch healed');
        yield* deathManager.reviveWerewolfVictim;
        yield* gameFlow.markSegmentAsSkipped('WITCH_HEAL');
        yield* gameFlow.finishSegment;
      });

      const handleWitchSkipHeal = Effect.fn('handleWitchSkipHeal')(
        function* () {
          yield* Effect.log('witch did not heal');
          yield* deathManager.log;
          yield* gameFlow.finishSegment;
        }
      );

      const handleWitchPoison = Effect.fn('handleWitchPoison')(function* (
        victim: string
      ) {
        yield* Effect.log('adding victim to list');
        yield* deathManager.addToPendingDeath('WITCH_POISON', victim);
        yield* game.witchUsedKill;
        yield* gameFlow.finishSegment;
      });

      const handleWitchSkipPoison = Effect.fn('handleWitchSkipPoison')(
        function* () {
          yield* Effect.log('skipping poison');
          yield* gameFlow.finishSegment;
        }
      );

      const handleStartGame = Effect.fn('handleStartGame')(function* () {
        yield* Effect.log('starting game');
        yield* gameFlow.startGame;
      });

      const handleStartMock = Effect.fn('handleStartMock')(function* (
        segment: Exclude<
          import('@repo/types').SegmentType,
          'CUPID' | 'HUNTER' | 'DAY_VOTE' | 'WITCH_POISON'
        >
      ) {
        yield* Effect.log(`starting mock segment ${segment}`);
        if (
          !(
            segment === 'WEREWOLF' ||
            segment === 'LOVERS' ||
            segment === 'WITCH_HEAL'
          )
        ) {
          yield* Effect.log(`add segment ${segment} functionality`);
        }
        yield* gameFlow.loadMockScenario(segment);
      });

      const getAlertWerewolvesAboutVotes = Effect.fn(
        'getAlertWerewolvesAboutVotes'
      )(function* () {
        const voteData = yield* werewolvesVotes.getVotes;
        const werewolves = yield* game.getWerewolves;

        return { voteData, werewolves };
      });

      return {
        handlePlayerJoin,
        handleGetPlayersList,
        handleWerewolfVote,
        handleLoverClosedAlert,
        handleCupidLoversPick,
        handleWitchHeal,
        handleWitchSkipHeal,
        handleWitchPoison,
        handleWitchSkipPoison,
        handleStartGame,
        handleStartMock,
        getAlertWerewolvesAboutVotes,
      };
    }),
  }
) {}
