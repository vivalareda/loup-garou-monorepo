import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { GameActions } from '@/core/game-actions';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import type { Broadcaster } from '@/server/broadcaster';

/** Real game objects around a recording broadcaster; tests stub what they steer. */
function buildGameActions() {
  const io = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } satisfies Broadcaster;

  const deathManager = new DeathManager();
  const game = new Game(io, deathManager);
  const audioManager = new AudioManager(deathManager);

  const segmentsManager = new SegmentsManager(
    game,
    io,
    audioManager,
    new SpecialScenarios(game, audioManager)
  );

  return {
    io,
    game,
    segmentsManager,
    gameActions: new GameActions(game, io, segmentsManager),
  };
}

describe('GameActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  test('dayAction ends via the segments manager when a faction has won', async () => {
    const { io, game, segmentsManager, gameActions } = buildGameActions();
    vi.spyOn(game, 'processPendingDeaths').mockReturnValue([]);

    const isGameOver = vi
      .spyOn(segmentsManager, 'isGameOver')
      .mockReturnValue(true);

    await gameActions.dayAction();

    // isGameOver is the only victory path: it records the FINISHED state
    // that game:restart checks. No discussion may start after a win.
    expect(isGameOver).toHaveBeenCalled();
    expect(io.emit).not.toHaveBeenCalledWith(
      'game:countdown',
      'DAY-DISCUSSION',
      expect.anything()
    );
  });

  test('dayAction announces night deaths before checking the winner', async () => {
    const deaths: ReturnType<Game['processPendingDeaths']> = [
      {
        playerId: 'victim-sid',
        playerName: 'Alice',
        cause: 'WEREWOLVES',
        timestamp: new Date(),
      },
    ];

    const { io, game, segmentsManager, gameActions } = buildGameActions();
    vi.spyOn(game, 'processPendingDeaths').mockReturnValue(deaths);
    vi.spyOn(segmentsManager, 'isGameOver').mockReturnValue(false);

    await gameActions.dayAction();

    expect(io.emit).toHaveBeenCalledWith('night:deaths-announced', deaths);
  });

  test('loversAction sends each lover the other lover display name', () => {
    const { io, game, gameActions } = buildGameActions();
    game.addPlayer('Alice', 'lover-1-sid');
    game.addPlayer('Bob', 'lover-2-sid');
    game.setLovers(['lover-1-sid', 'lover-2-sid']);

    gameActions.loversAction();
    vi.advanceTimersByTime(4000);

    expect(io.to).toHaveBeenCalledWith('lover-1-sid');
    expect(io.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Bob');
    expect(io.to).toHaveBeenCalledWith('lover-2-sid');
    expect(io.emit).toHaveBeenCalledWith('alert:player-is-lover', 'Alice');
  });
});
