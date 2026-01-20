import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DayVoting } from '../DayVoting.js';
import { Game } from '../Game.js';
import { SocketServer } from '../SocketServer.js';

describe('DayVoting', () => {
  const mockPlayer = (id: string, name: string, isAlive = true) => ({
    getSocketId: () => id,
    getName: () => name,
    isAlive,
  });

  const mockGame = {
    getPlayerBySocketId: (id: string) => {
      if (id === 'voter1') {
        return Effect.succeed(mockPlayer('voter1', 'Voter 1'));
      }
      if (id === 'voter2') {
        return Effect.succeed(mockPlayer('voter2', 'Voter 2'));
      }
      if (id === 'target1') {
        return Effect.succeed(mockPlayer('target1', 'Target 1'));
      }
      if (id === 'target2') {
        return Effect.succeed(mockPlayer('target2', 'Target 2'));
      }
      if (id === 'deadVoter') {
        return Effect.succeed(mockPlayer('deadVoter', 'Dead Voter', false));
      }
      if (id === 'deadTarget') {
        return Effect.succeed(mockPlayer('deadTarget', 'Dead Target', false));
      }
      return Effect.fail(new Error('Player not found'));
    },
  } as unknown as Game;

  const mockSocketServer = {
    emit: vi.fn(() => Effect.void),
  } as unknown as SocketServer;

  const Mocks = Layer.mergeAll(
    Layer.succeed(Game, mockGame),
    Layer.succeed(SocketServer, mockSocketServer)
  );

  const TestLayer = DayVoting.Test.pipe(Layer.provide(Mocks));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start voting', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
    }).pipe(Effect.provide(TestLayer)); // Provide layer directly to the effect

    await Effect.runPromise(program);
    expect(mockSocketServer.emit).toHaveBeenCalledWith('day-vote:start');
  });

  it('should handle vote and broadcast update', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('voter1', 'target1');
    }).pipe(Effect.provide(TestLayer));

    await Effect.runPromise(program);
    expect(mockSocketServer.emit).toHaveBeenCalledWith('day-vote:update', {
      target1: 1,
    });
  });

  it('should fail if voting is closed', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      // Voting not started
      yield* voting.handleVote('voter1', 'target1');
    }).pipe(Effect.provide(TestLayer));

    await expect(Effect.runPromise(program)).rejects.toThrow();
  });

  it('should fail if voter is dead', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('deadVoter', 'target1');
    }).pipe(Effect.provide(TestLayer));

    await expect(Effect.runPromise(program)).rejects.toThrow();
  });

  it('should fail if target is dead', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('voter1', 'deadTarget');
    }).pipe(Effect.provide(TestLayer));

    await expect(Effect.runPromise(program)).rejects.toThrow();
  });

  it('should update vote if voter votes again', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('voter1', 'target1');
      yield* voting.handleVote('voter1', 'target2');
    }).pipe(Effect.provide(TestLayer));

    await Effect.runPromise(program);
    // First vote
    expect(mockSocketServer.emit).toHaveBeenCalledWith('day-vote:update', {
      target1: 1,
    });
    // Second vote - should be only target2: 1
    expect(mockSocketServer.emit).toHaveBeenLastCalledWith('day-vote:update', {
      target2: 1,
    });
  });

  it('should finalize vote correctly', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('voter1', 'target1');
      yield* voting.handleVote('voter2', 'target1');
      return yield* voting.finalizeVote;
    }).pipe(Effect.provide(TestLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe('target1');
  });

  it('should handle tie by picking randomly', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      yield* voting.handleVote('voter1', 'target1');
      yield* voting.handleVote('voter2', 'target2');
      return yield* voting.finalizeVote;
    }).pipe(Effect.provide(TestLayer));

    const result = await Effect.runPromise(program);
    expect(['target1', 'target2']).toContain(result);
  });

  it('should return null if no votes', async () => {
    const program = Effect.gen(function* () {
      const voting = yield* DayVoting;
      yield* voting.startVoting;
      return yield* voting.finalizeVote;
    }).pipe(Effect.provide(TestLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBeNull();
  });
});
