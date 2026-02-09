import { Context, Effect, Layer } from 'effect';
import { PlayerNotWerewolfError } from './errors.js';
import { Game } from './Game.js';

const makeWerewolvesVote = Effect.gen(function* () {
  const votes: Map<string, string> = new Map();
  const game = yield* Game;

  const registerWerewolfVote = Effect.fn('registerWerewolfVote')(function* (
    werewolfId: string,
    victim: string
  ) {
    yield* Effect.log(`the werewof ${werewolfId} voted for ${victim}`);
    const werewolves = yield* game.getWerewolves;
    const isWerewolf = werewolves.some((w) => w.getSocketId() === werewolfId);

    if (!isWerewolf) {
      return yield* new PlayerNotWerewolfError({ socketId: werewolfId });
    }

    votes.set(werewolfId, victim);

    if (votes.size !== werewolves.length) {
      return false;
    }

    return hasAllAgreed();
  });

  const updateWerewolfVote = Effect.fn('updateWerewolfVote')(function* (
    werewolfId: string,
    victim: string
  ) {
    yield* Effect.log(`the werewof ${werewolfId} updated vote to ${victim}`);
    const werewolves = yield* game.getWerewolves;
    const isWerewolf = werewolves.some((w) => w.getSocketId() === werewolfId);

    if (!isWerewolf) {
      return yield* new PlayerNotWerewolfError({ socketId: werewolfId });
    }

    votes.set(werewolfId, victim);
    yield* Effect.log('the votes are:');
    yield* Effect.log([...votes.entries()]);
    yield* Effect.log(`length: ${werewolves.length}`);

    if (votes.size !== werewolves.length) {
      return false;
    }

    return hasAllAgreed();
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

  const hasAllAgreed = () => {
    const votesArr = Array.from(votes.values());
    const firstVictim = votesArr[0];
    const allAgree = votesArr.every((victim) => victim === firstVictim);

    return allAgree ? firstVictim : false;
  };

  const clear = Effect.sync(() => votes.clear());

  return {
    registerWerewolfVote,
    updateWerewolfVote,
    getVotes,
    clear,
  };
});

type WerewolvesVoteService = typeof makeWerewolvesVote extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class WerewolvesVote extends Context.Tag('WerewolvesVote')<
  WerewolvesVote,
  WerewolvesVoteService
>() {
  static readonly DefaultWithoutDependencies = Layer.effect(
    this,
    makeWerewolvesVote
  );
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Game.Default)
  );
}
