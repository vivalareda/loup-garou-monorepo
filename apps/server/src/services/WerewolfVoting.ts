import type { WerewolvesVoteState } from '@repo/types';
import { Console, Effect, Layer, Ref } from 'effect';
import { Game } from './Game.js';
import { SocketServer } from './SocketServer.js';
import { InvalidVoterError, InvalidVoteTargetError } from './voting-errors.js';

type VoteMap = Record<string, string>; // voterId -> targetId

const make = Effect.gen(function* () {
  const game = yield* Game;
  const socketServer = yield* SocketServer;

  // State to track who voted for whom
  const votesRef = yield* Ref.make<VoteMap>({});

  const broadcastVotes = (votes: VoteMap) =>
    Effect.gen(function* () {
      const counts: WerewolvesVoteState = {};
      for (const target of Object.values(votes)) {
        counts[target] = (counts[target] || 0) + 1;
      }

      const werewolves = yield* game.getPlayers.pipe(
        Effect.map((players) =>
          players.filter((p) => p.getRole() === 'WEREWOLF')
        )
      );

      for (const werewolf of werewolves) {
        yield* socketServer.emitTo(
          werewolf.getSocketId(),
          'werewolf:current-votes',
          counts
        );
      }
    });

  const getVoteResult = Effect.gen(function* () {
    const votes = yield* Ref.get(votesRef);
    const counts: WerewolvesVoteState = {};

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

    // If there's a tie, pick one randomly (common rule variant, or could be no-kill)
    // For now we'll pick randomly if there's a tie to ensure progress
    if (candidates.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidates.length);
      return candidates[randomIndex];
    }

    return null;
  });

  return {
    _tag: '@app/WerewolfVoting' as const,
    // Called when a werewolf submits a vote
    handleVote: (voterId: string, targetId: string) =>
      Effect.gen(function* () {
        // 1. Validation
        const voter = yield* game.getPlayerBySocketId(voterId);
        if (voter.getRole() !== 'WEREWOLF' || !voter.isAlive) {
          return yield* Effect.fail(
            new InvalidVoterError({
              socketId: voterId,
              reason: 'Player is not an alive werewolf',
            })
          );
        }

        // Check if target is valid (exists and is alive)
        const target = yield* game.getPlayerBySocketId(targetId);
        if (!target.isAlive) {
          return yield* Effect.fail(
            new InvalidVoteTargetError({
              targetId,
              reason: 'Target is dead',
            })
          );
        }

        // 2. Update Vote State
        yield* Ref.update(votesRef, (currentVotes) => {
          // If voter already voted for this target, maybe toggle?
          // Usually in UI, clicking same target might not toggle, but let's assume update
          return { ...currentVotes, [voterId]: targetId };
        });

        // 3. Notify all werewolves of the update
        const updatedVotes = yield* Ref.get(votesRef);
        yield* broadcastVotes(updatedVotes);

        yield* Console.log(
          `[Werewolf Vote] ${voter.getName()} voted for ${target.getName()}`
        );
      }),

    // Called to reset votes at start of phase
    resetVotes: Effect.gen(function* () {
      yield* Ref.set(votesRef, {});
    }),

    // Called to finalize the vote (e.g. at end of timer)
    finalizeVote: Effect.gen(function* () {
      const victimId = yield* getVoteResult;

      // Notify werewolves that voting is complete
      const werewolves = yield* game.getPlayers.pipe(
        Effect.map((players) =>
          players.filter((p) => p.getRole() === 'WEREWOLF')
        )
      );

      for (const werewolf of werewolves) {
        yield* socketServer.emitTo(
          werewolf.getSocketId(),
          'werewolf:voting-complete'
        );
      }

      if (victimId) {
        const victim = yield* game.getPlayerBySocketId(victimId);
        yield* Console.log(
          `[Werewolf Consensus] Chosen victim: ${victim.getName()}`
        );
        return victimId;
      }
      yield* Console.log('[Werewolf Consensus] No victim chosen.');
      return null;
    }),
  };
});

export class WerewolfVoting extends Effect.Service<WerewolfVoting>()(
  '@app/WerewolfVoting',
  {
    effect: make,
    dependencies: [Game.Default, SocketServer.Default],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
