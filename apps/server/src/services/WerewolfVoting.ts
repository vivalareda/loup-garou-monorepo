import { Effect } from 'effect';
import { Game } from './Game.js';
import { SharedState } from './SharedState.js';
import { SocketServer } from './SocketServer.js';

export class WerewolfVoting extends Effect.Service<WerewolfVoting>()(
  '@app/WerewolfVoting',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const sharedState = yield* SharedState;
      const io = yield* SocketServer;

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

      const handleVote = Effect.fn('handleVote')(function* (
        voterSid: string,
        targetSid: string
      ) {
        const players = yield* getPlayersMap();
        yield* sharedState.setWerewolfVote(voterSid, targetSid, players);
        yield* broadcastCurrentVotes();
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
      });

      return {
        handleVote,
        handleVoteUpdate,
        broadcastCurrentVotes,
      };
    }),
    dependencies: [Game.Default, SharedState.Default, SocketServer.Default],
  }
) {}
