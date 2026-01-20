import { Effect, Layer, Ref } from 'effect';
import { Game } from './Game.js';
import { SocketServer } from './SocketServer.js';
import {
  InvalidVoterError,
  InvalidVoteTargetError,
  VotingClosedError,
} from './voting-errors.js';

type DayVoteMap = Record<string, string>; // voterId -> targetId

const make = Effect.gen(function* () {
  const game = yield* Game;
  const socketServer = yield* SocketServer;

  // State
  const votesRef = yield* Ref.make<DayVoteMap>({});
  const isVotingOpenRef = yield* Ref.make<boolean>(false);

  // Broadcast current votes to all alive players
  const broadcastVotes = (votes: DayVoteMap) =>
    Effect.gen(function* () {
      const counts: Record<string, number> = {};
      for (const target of Object.values(votes)) {
        counts[target] = (counts[target] || 0) + 1;
      }

      // Emit to everyone for public voting transparency
      yield* socketServer.emit('day-vote:update', counts);
    });

  return {
    _tag: '@app/DayVoting' as const,
    startVoting: Effect.gen(function* () {
      yield* Ref.set(votesRef, {});
      yield* Ref.set(isVotingOpenRef, true);
      yield* socketServer.emit('day-vote:start');
    }),

    stopVoting: Effect.gen(function* () {
      yield* Ref.set(isVotingOpenRef, false);
    }),

    handleVote: (voterId: string, targetId: string) =>
      Effect.gen(function* () {
        const isOpen = yield* Ref.get(isVotingOpenRef);
        if (!isOpen) {
          return yield* Effect.fail(new VotingClosedError());
        }

        const voter = yield* game.getPlayerBySocketId(voterId);
        if (!voter.isAlive) {
          return yield* Effect.fail(
            new InvalidVoterError({
              socketId: voterId,
              reason: 'Player is dead',
            })
          );
        }

        const target = yield* game.getPlayerBySocketId(targetId);
        if (!target.isAlive) {
          return yield* Effect.fail(
            new InvalidVoteTargetError({
              targetId,
              reason: 'Target is dead',
            })
          );
        }

        yield* Ref.update(votesRef, (votes) => ({
          ...votes,
          [voterId]: targetId,
        }));

        const updatedVotes = yield* Ref.get(votesRef);
        yield* broadcastVotes(updatedVotes);
      }),

    finalizeVote: Effect.gen(function* () {
      const votes = yield* Ref.get(votesRef);
      const counts: Record<string, number> = {};

      for (const target of Object.values(votes)) {
        counts[target] = (counts[target] || 0) + 1;
      }

      let maxVotes = 0;
      const candidates: string[] = [];

      for (const [target, count] of Object.entries(counts)) {
        if (count > maxVotes) {
          maxVotes = count;
          candidates.length = 0;
          candidates.push(target);
        } else if (count === maxVotes) {
          candidates.push(target);
        }
      }

      // Tie handling
      if (candidates.length === 0) {
        // No votes cast
        return null;
      }

      if (candidates.length > 1) {
        // Tie handling: Pick randomly
        const randomIndex = Math.floor(Math.random() * candidates.length);
        return candidates[randomIndex];
      }

      return candidates[0];
    }),
  };
});

export class DayVoting extends Effect.Service<DayVoting>()('@app/DayVoting', {
  effect: make,
  dependencies: [Game.Default, SocketServer.Default],
}) {
  static readonly Test = Layer.effect(this, make);
}
