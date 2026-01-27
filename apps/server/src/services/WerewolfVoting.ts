import { Effect } from 'effect';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { SharedState } from './SharedState.js';
import { SocketServer } from './SocketServer.js';

export class WerewolfVoting extends Effect.Service<WerewolfVoting>()(
  '@app/WerewolfVoting',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const gameFlow = yield* GameFlow;
      const sharedState = yield* SharedState;
      const io = yield* SocketServer;
      let lastConsensusTarget: string | null = null;
      let hasFinishedSegment = false;

      const getPlayersMap = Effect.fn('getPlayersMap')(function* () {
        const players = yield* game.getPlayers;
        return new Map(players.map((player) => [player.getSocketId(), player]));
      });

      const broadcastCurrentVotes = Effect.fn('broadcastCurrentVotes')(
        function* () {
          const voteTallies = yield* sharedState.getWerewolfVoteTallies;
          const werewolves = yield* game.getWerewolves;

          for (const werewolf of werewolves) {
            io.to(werewolf.getSocketId()).emit(
              'werewolf:current-votes',
              voteTallies
            );
          }
        }
      );

      const maybeEmitVotingComplete = Effect.fn('maybeEmitVotingComplete')(
        function* () {
          const werewolves = yield* game.getWerewolves;
          const werewolfSids = werewolves.map((werewolf) =>
            werewolf.getSocketId()
          );
          const target = yield* sharedState.getWerewolfTarget(werewolfSids);

          if (!target) {
            if (lastConsensusTarget) {
              const removed = yield* sharedState.removePendingDeath(
                lastConsensusTarget
              );
              if (removed && removed.cause !== 'WEREWOLVES') {
                yield* sharedState.addPendingDeath(removed);
              }
              lastConsensusTarget = null;
            }
            hasFinishedSegment = false;
            return;
          }

          if (lastConsensusTarget && lastConsensusTarget !== target) {
            const removed = yield* sharedState.removePendingDeath(
              lastConsensusTarget
            );
            if (removed && removed.cause !== 'WEREWOLVES') {
              yield* sharedState.addPendingDeath(removed);
            }
          }

          lastConsensusTarget = target;
          yield* sharedState.addPendingDeath({
            playerId: target,
            cause: 'WEREWOLVES',
          });

          for (const werewolf of werewolves) {
            io.to(werewolf.getSocketId()).emit('werewolf:voting-complete');
          }

          if (!hasFinishedSegment) {
            const currentSegment = yield* gameFlow.getCurrentSegment;
            if (currentSegment.type === 'WEREWOLF') {
              hasFinishedSegment = true;
              yield* gameFlow.finishSegment;
            }
          }
        }
      );

      const handleVote = Effect.fn('handleVote')(function* (
        voterSid: string,
        targetSid: string
      ) {
        const players = yield* getPlayersMap();
        yield* sharedState.setWerewolfVote(voterSid, targetSid, players);
        yield* broadcastCurrentVotes();
        yield* maybeEmitVotingComplete();
      });

      const handleVoteUpdate = Effect.fn('handleVoteUpdate')(function* (
        voterSid: string,
        targetSid: string,
        oldTargetSid: string
      ) {
        const players = yield* getPlayersMap();
        yield* sharedState.updateWerewolfVote(
          voterSid,
          targetSid,
          oldTargetSid,
          players
        );
        yield* broadcastCurrentVotes();
        yield* maybeEmitVotingComplete();
      });

      return {
        handleVote,
        handleVoteUpdate,
        broadcastCurrentVotes,
      };
    }),
    dependencies: [
      Game.Default,
      GameFlow.Default,
      SharedState.Default,
      SocketServer.Default,
    ],
  }
) {}
