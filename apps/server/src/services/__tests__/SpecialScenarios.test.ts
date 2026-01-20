import { Effect, Layer } from 'effect';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '../../core/player.js';
import { AudioManager } from '../AudioManager.js';
import { DeathManager } from '../DeathManager.js';
import { Game } from '../Game.js';
import { makeSpecialScenarios, SpecialScenarios } from '../SpecialScenarios.js';

describe('SpecialScenarios', () => {
  const gameMock = {
    getPlayerBySocketId: vi.fn(),
    getPartner: vi.fn(),
  };

  const audioManagerMock = {
    playSpecialAudio: vi.fn().mockReturnValue(Effect.succeed(undefined)),
  };

  const deathManagerMock = {
    getPendingDeaths: vi.fn(),
  };

  const TestLayer = Layer.effect(SpecialScenarios, makeSpecialScenarios).pipe(
    Layer.provide(Layer.succeed(Game, gameMock as any)),
    Layer.provide(Layer.succeed(AudioManager, audioManagerMock as any)),
    Layer.provide(Layer.succeed(DeathManager, deathManagerMock as any))
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect hunter is lover scenario', async () => {
    const deaths = [{ playerId: 'p1', cause: 'WEREWOLVES' }];
    deathManagerMock.getPendingDeaths.mockImplementation(() => {
      return Effect.succeed(deaths);
    });

    const player1 = { getRole: () => 'HUNTER', getSocketId: () => 'p1' };
    const player2 = { getRole: () => 'VILLAGER', getSocketId: () => 'p2' };

    gameMock.getPlayerBySocketId.mockImplementation((id) => {
      return Effect.succeed(player1);
    });
    gameMock.getPartner.mockImplementation((p) => {
      return Effect.succeed(player2);
    });

    const program = Effect.gen(function* () {
      const service = yield* SpecialScenarios;
      return yield* service.handleSpecialDeathScenarios;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(result).toBe('HUNTER_IS_LOVER');
    expect(audioManagerMock.playSpecialAudio).toHaveBeenCalledWith(
      'HUNTER_IS_LOVER'
    );
  });

  it('should detect partner of hunter died scenario', async () => {
    const deaths = [{ playerId: 'p1', cause: 'WEREWOLVES' }];
    deathManagerMock.getPendingDeaths.mockReturnValue(Effect.succeed(deaths));

    const player1 = { getRole: () => 'VILLAGER', getSocketId: () => 'p1' };
    const player2 = { getRole: () => 'HUNTER', getSocketId: () => 'p2' };

    gameMock.getPlayerBySocketId.mockReturnValue(Effect.succeed(player1));
    gameMock.getPartner.mockReturnValue(Effect.succeed(player2));

    const program = Effect.gen(function* () {
      const service = yield* SpecialScenarios;
      return yield* service.handleSpecialDeathScenarios;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestLayer))
    );

    expect(result).toBe('PARTNER_IS_HUNTER');
    expect(audioManagerMock.playSpecialAudio).toHaveBeenCalledWith(
      'LOVER_DEATH'
    );
    expect(audioManagerMock.playSpecialAudio).toHaveBeenCalledWith(
      'PARTNER_IS_HUNTER'
    );
  });
});
