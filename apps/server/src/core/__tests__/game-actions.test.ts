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
      processPendingDeaths: vi.fn().mockReturnValue([]),
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

  test('dayAction announces night deaths before checking the winner', async () => {
    const deaths = [
      {
        playerId: 'victim-sid',
        playerName: 'Alice',
        cause: 'WEREWOLVES',
        timestamp: new Date(),
      },
    ];
    const mockGame = {
      processPendingDeaths: vi.fn().mockReturnValue(deaths),
      checkIfWinner: vi.fn().mockReturnValue(null),
    } as unknown as Game;
    const mockIo = {
      emit: vi.fn(),
    } as unknown as SocketType;
    const mockAudioManager = {
      playDayStartAudio: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioManager;
    const gameActions = new GameActions(mockGame, mockIo, mockAudioManager);

    await gameActions.dayAction();

    expect(mockIo.emit).toHaveBeenCalledWith('night:deaths-announced', deaths);
  });

  test('loversAction sends each lover the other lover display name', () => {
    const lover1 = {
      getSocketId: () => 'lover-1-sid',
      getName: () => 'Alice',
    };
    const lover2 = {
      getSocketId: () => 'lover-2-sid',
      getName: () => 'Bob',
    };
    const mockGame = {
      getLovers: vi.fn().mockReturnValue([lover1, lover2]),
    } as unknown as Game;
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;
    const gameActions = new GameActions(
      mockGame,
      mockIo,
      {} as unknown as AudioManager
    );

    gameActions.loversAction();
    vi.advanceTimersByTime(4000);

    expect(mockIo.to).toHaveBeenCalledWith('lover-1-sid');
    expect(mockIo.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Bob');
    expect(mockIo.to).toHaveBeenCalledWith('lover-2-sid');
    expect(mockIo.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Alice');
  });
});
