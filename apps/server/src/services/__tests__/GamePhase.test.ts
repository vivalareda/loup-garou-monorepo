import { Effect, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { Player } from '../../core/player.js';
import { DeathManager } from '../DeathManager.js';
import { Game } from '../Game.js';
import { GameActions } from '../GameActions.js';
import { GamePhase, makeGamePhase } from '../GamePhase.js';
import { SocketHandlers } from '../SocketHandlers.js';

describe('GamePhase', () => {
  const mockPlayer = new Player('TestPlayer', 'socket1', 'VILLAGER');

  const GameMock = {
    getPlayers: Effect.succeed([mockPlayer]),
    getPlayerBySocketId: () => Effect.succeed(mockPlayer),
    getSpecialRolePlayer: (role: string) => {
      if (role === 'CUPID')
        return Effect.succeed(new Player('Cupid', 'cupid', 'CUPID'));
      return Effect.fail(new Error('Not found'));
    },
    getPartner: () => Effect.succeed(undefined),
  };

  const socketHandlersEmitSpy = vi.fn((event, data) => {
    return Effect.succeed(undefined);
  });

  const SocketHandlersMock = {
    emit: socketHandlersEmitSpy,
  };

  const DeathManagerMock = {
    processDeaths: (fn: any) => Effect.succeed([]),
    checkWinner: () => Effect.succeed(null),
  };

  const GameActionsMock = {
    cupidAction: Effect.succeed(undefined),
    loversAction: Effect.succeed(undefined),
    werewolfAction: Effect.succeed(undefined),
    hunterAction: Effect.succeed(undefined),
    witchHealAction: Effect.succeed(undefined),
    witchPoisonAction: Effect.succeed(undefined),
  };

  it('should play a segment and call the corresponding action', async () => {
    const program = Effect.gen(function* () {
      const gamePhase = yield* makeGamePhase;
      yield* gamePhase.playSegment({ type: 'CUPID', skip: false });
    });

    // Create Test Layers
    const GameLayer = Layer.succeed(Game, GameMock as any);

    // Use Layer.succeed for SocketHandlers to ensure the spy is used
    const SocketLayer = Layer.succeed(SocketHandlers, {
      emit: socketHandlersEmitSpy,
    } as unknown as SocketHandlers);

    const DeathManagerLayer = Layer.succeed(
      DeathManager,
      DeathManagerMock as any
    );
    const GameActionsLayer = Layer.succeed(GameActions, GameActionsMock as any);

    const TestLayer = Layer.mergeAll(
      GameLayer,
      SocketLayer,
      DeathManagerLayer,
      GameActionsLayer
    );

    await Effect.runPromise(program.pipe(Effect.provide(TestLayer)));

    expect(socketHandlersEmitSpy).toHaveBeenCalledWith('game:segment-start', {
      type: 'CUPID',
      skip: false,
    });
  });
});
