import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { AudioManager } from '@/segments/audio-manager';
import type { SocketType } from '@/server/sockets';

describe('GameActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  test('should alert werewolves as winners when they win after day action', async () => {
    const mockGame = {
      processPendingDeaths: vi.fn(),
      checkIfWinner: vi.fn().mockReturnValue('werewolves'),
      alertWinnersAndLosers: vi.fn(),
    } as unknown as Game;

    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    const mockAudioManager = {
      playWinnerAudio: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioManager;

    const gameActions = new GameActions(mockGame, mockIo, mockAudioManager);

    await gameActions.dayAction();

    expect(mockGame.processPendingDeaths).toHaveBeenCalled();
    expect(mockGame.checkIfWinner).toHaveBeenCalled();
    expect(mockAudioManager.playWinnerAudio).toHaveBeenCalledWith('werewolves');
    expect(mockGame.alertWinnersAndLosers).toHaveBeenCalledWith('werewolves');
  });
});
