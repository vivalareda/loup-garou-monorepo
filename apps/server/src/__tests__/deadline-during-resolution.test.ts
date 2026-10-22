import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import type { Broadcaster } from '@/server/broadcaster';
import { EventsActions } from '@/server/events-actions';
import { enterSegment } from './helpers/segments';

/** Lets every promise continuation (and 0ms timer) run. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/**
 * The DAY deadline expiring while a resolution waits on the hunter's
 * pick: the resolution must finish (its deaths are already in motion)
 * before the deadline may move the game on.
 */
describe('a DAY deadline expiring during a resolution', () => {
  let emit: ReturnType<typeof vi.fn>;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('DAY_VOTE_TIMEOUT_MS', '1000');
    vi.stubEnv('DAY_DISCUSSION_MS', '0');
    emit = vi.fn();

    const io = {
      to: vi.fn().mockReturnThis(),
      emit,
    } satisfies Broadcaster;

    const deathManager = new DeathManager();
    game = new Game(io, deathManager);
    const audioManager = new AudioManager(deathManager);
    segmentsManager = new SegmentsManager(
      game,
      io,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );
    eventsActions = new EventsActions(game, segmentsManager, io);
  });

  afterEach(() => {
    segmentsManager.resetForNewGame();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<Player['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);

    if (role === 'HUNTER') {
      game.setSpecialRolePlayer(player);
    }

    return player;
  };

  const addFivePlayers = () => ({
    hunter: addPlayer('Hunter', 'h-id', 'HUNTER'),
    first: addPlayer('V1', 'v1-id', 'VILLAGER'),
    second: addPlayer('V2', 'v2-id', 'VILLAGER'),
    third: addPlayer('V3', 'v3-id', 'VILLAGER'),
    wolf: addPlayer('Wolf', 'w-id', 'WEREWOLF'),
  });

  const timedOut = () =>
    emit.mock.calls.some((call) => call[0] === 'game:phase-timed-out');

  it('day vote: the hunter still takes his revenge, then the day ends once', async () => {
    const { hunter, first } = addFivePlayers();
    enterSegment(segmentsManager, 'DAY');
    await segmentsManager.playSegment();
    await flush();
    expect(eventsActions.hasPendingHunterPick()).toBe(false);

    for (const voter of ['v1-id', 'v2-id', 'v3-id', 'w-id']) {
      void eventsActions.handleDayVote(voter, 'h-id');
    }

    void eventsActions.handleDayVote('h-id', 'v1-id');
    await flush();
    expect(hunter.isAlive).toBe(false);
    expect(eventsActions.hasPendingHunterPick()).toBe(true);

    // The deadline expires while the hunter is still picking
    await vi.advanceTimersByTimeAsync(1000);
    expect(segmentsManager.getCurrentSegmentType()).toBe('DAY');
    expect(eventsActions.hasPendingHunterPick()).toBe(true);

    expect(eventsActions.submitHunterPick('v1-id')).toBe(true);
    await flush();

    expect(first.isAlive).toBe(false);
    // The resolution advanced the day itself; the deadline never fired
    expect(timedOut()).toBe(false);
    expect(segmentsManager.getCurrentSegmentType()).not.toBe('DAY');
  });

  it('dawn: the night deaths are processed before the day times out', async () => {
    const { hunter, first } = addFivePlayers();
    enterSegment(segmentsManager, 'DAY');
    game.addPendingDeath('h-id', 'WEREWOLVES');
    void segmentsManager.playSegment();
    await flush();
    expect(eventsActions.hasPendingHunterPick()).toBe(true);

    // The deadline expires while the dawn waits on the hunter's pick
    await vi.advanceTimersByTimeAsync(1000);
    expect(segmentsManager.getCurrentSegmentType()).toBe('DAY');

    expect(eventsActions.submitHunterPick('v1-id')).toBe(true);
    await flush();

    expect(hunter.isAlive).toBe(false);
    expect(first.isAlive).toBe(false);
    expect(game.getDeathQueue()).toHaveLength(0);
    // Then the expired deadline applies: nobody is voted out, night falls
    expect(timedOut()).toBe(true);
    expect(segmentsManager.getCurrentSegmentType()).not.toBe('DAY');
  });
});
