import { Context, Effect, Layer } from 'effect';
import { PlayerNotAliveError } from './errors.js';
import { Game } from './Game.js';

type DayVoteOutcome =
  | { result: 'InProgress' }
  | { result: 'MajorityVote'; victim: string }
  | { result: 'Tie'; tiedPlayers: string[] };

const makeDayVote = Effect.gen(function* () {
  const votes: Map<string, string> = new Map();
  const game = yield* Game;

  const registerVote = Effect.fn('registerDayVote')(function* (
    voterId: string,
    victim: string
  ) {
    yield* Effect.log(`Player ${voterId} voted for ${victim}`);

    const players = yield* game.getPlayers;
    const voter = players.find((p) => p.getSocketId() === voterId);

    if (!voter?.isAlive) {
      yield* Effect.log(`Player ${voterId} is not alive or does not exist`);
      return false;
    }

    votes.set(voterId, victim);

    const alivePlayers = players.filter((p) => p.isAlive);
    if (votes.size !== alivePlayers.length) {
      return false;
    }

    return hasMajority();
  });

  const updateVote = Effect.fn('updateDayVote')(function* (
    voterId: string,
    victim: string
  ) {
    yield* Effect.log(`Player ${voterId} updated vote to ${victim}`);

    const players = yield* game.getPlayers;
    const voter = players.find((p) => p.getSocketId() === voterId);

    if (!voter?.isAlive) {
      return yield* new PlayerNotAliveError({
        socketId: voter ? voter.getSocketId() : 'not found',
        message: 'error while trying to register day vote',
      });
    }

    votes.set(voterId, victim);
    yield* Effect.log('Day votes are:');
    yield* Effect.log([...votes.entries()]);

    const alivePlayers = players.filter((p) => p.isAlive);
    if (votes.size !== alivePlayers.length) {
      return { result: 'InProgress' as const };
    }

    return hasMajority();
  });

  const getVotes = Effect.gen(function* () {
    const players = yield* game.getClientPlayerList;
    const voteCounts: Record<string, number> = {};

    for (const victimSocketId of votes.values()) {
      const victimPlayer = players.find((p) => p.sid === victimSocketId);
      if (victimPlayer) {
        voteCounts[victimPlayer.name] =
          (voteCounts[victimPlayer.name] || 0) + 1;
      }
    }

    return voteCounts;
  });

  const countVotes = () => {
    const voteCounts = new Map<string, number>();
    for (const victim of votes.values()) {
      voteCounts.set(victim, (voteCounts.get(victim) || 0) + 1);
    }
    return voteCounts;
  };

  const findMaxVotes = (voteCounts: Map<string, number>) => {
    let maxVotes = 0;
    let topVictims: string[] = [];
    for (const [victimSid, count] of voteCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        topVictims = [victimSid];
      } else if (count === maxVotes) {
        topVictims.push(victimSid);
      }
    }
    return { maxVotes, topVictims };
  };

  const hasMajority = (): DayVoteOutcome => {
    const voteCounts = countVotes();
    const { maxVotes, topVictims } = findMaxVotes(voteCounts);
    const hasTie = topVictims.length > 1;
    const majorityThreshold = Math.floor(votes.size / 2) + 1;

    if (hasTie) {
      return {
        result: 'Tie',
        tiedPlayers: topVictims,
      };
    }

    if (maxVotes >= majorityThreshold) {
      return {
        result: 'MajorityVote',
        victim: topVictims[0],
      };
    }

    return { result: 'InProgress' as const };
  };

  const clear = Effect.sync(() => votes.clear());

  return {
    registerVote,
    updateVote,
    getVotes,
    clear,
  };
});

type DayVoteService = typeof makeDayVote extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class DayVote extends Context.Tag('DayVote')<DayVote, DayVoteService>() {
  static readonly DefaultWithoutDependencies = Layer.effect(this, makeDayVote);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Game.Default)
  );
}
