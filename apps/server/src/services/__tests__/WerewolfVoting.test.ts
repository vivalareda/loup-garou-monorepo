import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { PlayerNotFoundError } from '../errors.js';
import { Game } from '../Game.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';
import { WerewolfVoting } from '../WerewolfVoting.js';

describe('WerewolfVoting', () => {
  const mockEmitTo = vi.fn();
  const mockEmit = vi.fn();

  const MockSocketServer = Layer.succeed(
    SocketServer,
    SocketServer.of({
      io: {} as SocketIOInstance,
      emit: (event: any, ...args: any[]) =>
        Effect.sync(() => mockEmit(event, ...args)),
      emitTo: (socketId: any, event: any, ...args: any[]) =>
        Effect.sync(() => mockEmitTo(socketId, event, ...args)),
    } as any)
  );

  const ww1 = new Player('WW1', 'ww1-sid', 'WEREWOLF');
  const ww2 = new Player('WW2', 'ww2-sid', 'WEREWOLF');
  const villager = new Player('Villager', 'v-sid', 'VILLAGER');
  const deadVillager = new Player('Dead', 'dead-sid', 'VILLAGER');
  deadVillager.kill();

  const players = [ww1, ww2, villager, deadVillager];
  const playersMap = new Map(players.map((p) => [p.getSocketId(), p]));

  const MockGame = Layer.succeed(
    Game,
    Game.of({
      getPlayers: Effect.succeed(players),
      getPlayerBySocketId: (socketId: string) =>
        Effect.gen(function* () {
          const player = playersMap.get(socketId);
          if (!player) {
            return yield* Effect.fail(new PlayerNotFoundError({ socketId }));
          }
          return player;
        }),
    } as any)
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handleVote should fail if voter is not a werewolf', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* WerewolfVoting;
      yield* voting.handleVote('v-sid', 'ww1-sid');
    });

    const runnable = program.pipe(
      Effect.provide(WerewolfVoting.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    try {
      await Effect.runPromise(runnable);
      expect.fail('Should have failed');
    } catch (error: any) {
      // Sometimes errors are wrapped in FiberFailure, we need to check properties
      // or check instanceof if the error class is preserved
      if (error && typeof error === 'object' && '_tag' in error) {
        expect(error._tag).toBe('InvalidVoterError');
      } else if (error && error.toJSON) {
        // FiberFailure often has toJSON
        // The structure might be nested depending on how Effect wraps it
        // Let's fallback to checking the name or string representation if direct access fails
        // But for now, let's try to see what we got.
        // If it is a FiberFailure, it might wrap the cause.
        // Let's assume for this specific test environment, we might need to look deeper or rely on a different check.
        // Since previous test output showed (FiberFailure) InvalidVoterError, it means the cause IS InvalidVoterError.
        // Let's try matching the string representation which seemed to contain the name.
        expect(String(error)).toContain('InvalidVoterError');
      } else {
        expect(String(error)).toContain('InvalidVoterError');
      }
    }
  });

  it('handleVote should fail if target is dead', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* WerewolfVoting;
      yield* voting.handleVote('ww1-sid', 'dead-sid');
    });

    const runnable = program.pipe(
      Effect.provide(WerewolfVoting.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    try {
      await Effect.runPromise(runnable);
      expect.fail('Should have failed');
    } catch (error: any) {
      expect(String(error)).toContain('InvalidVoteTargetError');
    }
  });

  it('handleVote should broadcast updated votes to all werewolves', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* WerewolfVoting;
      yield* voting.handleVote('ww1-sid', 'v-sid');
    });

    const runnable = program.pipe(
      Effect.provide(WerewolfVoting.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    await Effect.runPromise(runnable);

    // Expect emitTo to be called for both werewolves
    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww1-sid',
      'werewolf:current-votes',
      { 'v-sid': 1 }
    );
    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww2-sid',
      'werewolf:current-votes',
      { 'v-sid': 1 }
    );
  });

  it('finalizeVote should return the winner of the vote', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* WerewolfVoting;
      yield* voting.handleVote('ww1-sid', 'v-sid');
      yield* voting.handleVote('ww2-sid', 'v-sid');
      const result = yield* voting.finalizeVote;
      return result;
    });

    const runnable = program.pipe(
      Effect.provide(WerewolfVoting.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    const result = await Effect.runPromise(runnable);
    expect(result).toBe('v-sid');
    // Verify notifications
    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww1-sid',
      'werewolf:voting-complete'
    );
    expect(mockEmitTo).toHaveBeenCalledWith(
      'ww2-sid',
      'werewolf:voting-complete'
    );
  });

  it('finalizeVote should return randomly on tie', async () => {
    // We can't easily test randomness deterministically without mocking Math.random,
    // but we can check it returns one of the candidates
    const program = Effect.gen(function* () {
      const voting = yield* WerewolfVoting;
      yield* voting.resetVotes;
      yield* voting.handleVote('ww1-sid', 'v-sid');
      yield* voting.handleVote('ww2-sid', 'ww1-sid'); // Self-preservation? :D
      const result = yield* voting.finalizeVote;
      return result;
    });

    const runnable = program.pipe(
      Effect.provide(WerewolfVoting.Test),
      Effect.provide(MockGame),
      Effect.provide(MockSocketServer)
    );

    const result = await Effect.runPromise(runnable);
    expect(['v-sid', 'ww1-sid']).toContain(result);
  });
});
