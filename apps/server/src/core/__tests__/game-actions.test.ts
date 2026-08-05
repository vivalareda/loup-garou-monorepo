import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

const makeSegmentsManager = (gameOver: boolean) =>
  ({
    isCurrentSegment: vi.fn().mockReturnValue(true),
    getRemainingDeadlineMs: vi.fn().mockReturnValue(null),
    isGameOver: vi.fn().mockReturnValue(gameOver),
  }) as unknown as SegmentsManager;

describe('GameActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  test('dayAction ends via the segments manager when a faction has won', async () => {
    const mockGame = {
      processPendingDeaths: vi.fn().mockReturnValue([]),
    } as unknown as Game;

    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    const segmentsManager = makeSegmentsManager(true);
    const gameActions = new GameActions(mockGame, mockIo, segmentsManager);

    await gameActions.dayAction();

    // isGameOver is the only victory path: it records the FINISHED state
    // that game:restart checks. No discussion may start after a win.
    expect(segmentsManager.isGameOver).toHaveBeenCalled();
    expect(mockIo.emit).not.toHaveBeenCalledWith(
      'game:countdown',
      'DAY-DISCUSSION',
      expect.anything()
    );
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
    } as unknown as Game;
    const mockIo = {
      emit: vi.fn(),
    } as unknown as SocketType;
    const gameActions = new GameActions(
      mockGame,
      mockIo,
      makeSegmentsManager(false)
    );

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
      makeSegmentsManager(false)
    );

    gameActions.loversAction();
    vi.advanceTimersByTime(4000);

    expect(mockIo.to).toHaveBeenCalledWith('lover-1-sid');
    expect(mockIo.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Bob');
    expect(mockIo.to).toHaveBeenCalledWith('lover-2-sid');
    expect(mockIo.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Alice');
  });
});
