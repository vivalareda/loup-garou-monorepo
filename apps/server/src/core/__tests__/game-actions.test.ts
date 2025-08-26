import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SocketType } from '@/server/sockets';

describe('GameActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  test('should alert werewolves as winners when they win after day action', () => {
    const mockGame = {
      processPendingDeaths: vi.fn(),
      checkIfWinner: vi.fn().mockReturnValue('werewolves'),
      alertWinner: vi.fn(),
    } as unknown as Game;

    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    const gameActions = new GameActions(mockGame, mockIo);

    gameActions.dayAction();

    vi.advanceTimersByTime(7000);

    expect(mockGame.processPendingDeaths).toHaveBeenCalled();
    expect(mockGame.checkIfWinner).toHaveBeenCalled();
    expect(mockGame.alertWinner).toHaveBeenCalledWith('werewolves');
  });
});
