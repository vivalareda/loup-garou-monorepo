import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionError } from '../../Domain/ActionError';
import { AudioManagerTag } from '../../segments/audio-manager-effect';
import { SocketService } from '../../server/socket-effect';
import { GameActionsLive, GameActionsService } from '../game-actions-effect';
import { GameService } from '../game-effect';

describe('GameActionsService', () => {
  const mockSocket = {
    to: vi.fn().mockReturnValue({
      emit: vi.fn().mockReturnValue(Effect.void),
    }),
    emit: vi.fn().mockReturnValue(Effect.void),
  };

  const mockGame = {
    getSpecialRolePlayer: vi.fn(),
    getLovers: vi.fn(),
    getWerewolfList: Effect.succeed([]), // Default valid Effect
    getWerewolfTarget: Effect.succeed(undefined), // Default valid Effect
    getWerewolfVoteTallies: Effect.succeed({}), // Default valid Effect
    handleWerewolfVote: vi.fn().mockReturnValue(Effect.void),
    handleWerewolfUpdateVote: vi.fn().mockReturnValue(Effect.void),
  };

  const mockAudioManager = {};

  const SocketServiceTest = Layer.succeed(
    SocketService,
    mockSocket as unknown as any
  );

  const GameServiceTest = Layer.succeed(
    GameService,
    mockGame as unknown as any
  );

  const AudioManagerTest = Layer.succeed(
    AudioManagerTag,
    mockAudioManager as unknown as any
  );

  const TestLayer = GameActionsLive.pipe(
    Layer.provide(SocketServiceTest),
    Layer.provide(GameServiceTest),
    Layer.provide(AudioManagerTest)
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset effects if they were mocked differently
    mockGame.getWerewolfList = Effect.succeed([]);
    mockGame.getWerewolfTarget = Effect.succeed(undefined);
  });

  it('should emit cupid:pick-required when cupid exists', async () => {
    const cupid = { getSocketId: () => 'cupid-sid' };
    mockGame.getSpecialRolePlayer.mockReturnValue(Effect.succeed(cupid));

    const program = Effect.gen(function* (_) {
      const service = yield* _(GameActionsService);
      yield* _(service.cupidAction);
    });

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(mockSocket.to).toHaveBeenCalledWith('cupid-sid');
    expect(mockSocket.to('cupid-sid').emit).toHaveBeenCalledWith(
      'cupid:pick-required'
    );
  });

  it('should fail cupidAction if cupid not found', async () => {
    mockGame.getSpecialRolePlayer.mockReturnValue(Effect.succeed(undefined));

    const program = Effect.gen(function* (_) {
      const service = yield* _(GameActionsService);
      yield* _(service.cupidAction);
    });

    await expect(
      Effect.runPromise(program.pipe(Effect.provide(TestLayer)))
    ).rejects.toThrow();
  });

  it('should emit werewolf:pick-required to all werewolves', async () => {
    const ww1 = { getSocketId: () => 'ww1-sid' };
    const ww2 = { getSocketId: () => 'ww2-sid' };
    mockGame.getWerewolfList = Effect.succeed([ww1, ww2]);

    const program = Effect.gen(function* (_) {
      const service = yield* _(GameActionsService);
      yield* _(service.werewolfAction);
    });

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(mockSocket.to).toHaveBeenCalledWith('ww1-sid');
    expect(mockSocket.to).toHaveBeenCalledWith('ww2-sid');
  });

  it('should emit witch:can-heal if witch and victim exist', async () => {
    const witch = { getSocketId: () => 'witch-sid' };
    mockGame.getSpecialRolePlayer.mockReturnValue(Effect.succeed(witch));
    mockGame.getWerewolfTarget = Effect.succeed('victim-sid');

    const program = Effect.gen(function* (_) {
      const service = yield* _(GameActionsService);
      yield* _(service.witchHealAction);
    });

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(mockSocket.to).toHaveBeenCalledWith('witch-sid');
    expect(mockSocket.to('witch-sid').emit).toHaveBeenCalledWith(
      'witch:can-heal',
      'victim-sid'
    );
  });
});
