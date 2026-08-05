import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('Night dawn: hunter who is a lover dies during the night', () => {
  let game: Game;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;
  let mockIo: SocketType;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn();
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: emitSpy,
    } as unknown as SocketType;

    const deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
    const audioManager = new AudioManager(deathManager);
    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );
    eventsActions = new EventsActions(game, segmentsManager, mockIo);
  });

  it('kills the partner, pauses for the pick, then kills the revenge target', async () => {
    const hunter = game.addPlayer('Hunter', 'mock-id-1');
    const partner = game.addPlayer('Partner', 'mock-id-2');
    const villager = game.addPlayer('Villager', 'mock-id-3');
    const werewolf = game.addPlayer('Werewolf', 'mock-id-4');

    hunter.setRole('HUNTER');
    game.setSpecialRolePlayer(hunter);
    partner.setRole('VILLAGER');
    villager.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    for (const p of [hunter, partner, villager, werewolf]) {
      game.setPlayerTeams(p);
    }

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    segmentsManager.playSegment();
    await tick();

    // Flow is parked waiting for the hunter's revenge pick
    expect(emitSpy.mock.calls.map((c) => c[0])).toContain(
      'hunter:pick-required'
    );
    // Queued deaths are not processed until the dawn completes
    expect(hunter.isAlive).toBe(true);

    eventsActions.submitHunterPick('mock-id-3');
    await tick();

    // Revenge target killed immediately; queued deaths processed by dayAction
    expect(villager.isAlive).toBe(false);
    expect(hunter.isAlive).toBe(false);
    expect(partner.isAlive).toBe(false);
    expect(werewolf.isAlive).toBe(true);
    expect(game.getDeathQueue()).toHaveLength(0);

    const lobbyDeathCallsForRevengeTarget = emitSpy.mock.calls.filter(
      (call) => call[0] === 'lobby:player-died' && call[1] === 'mock-id-3'
    );
    expect(lobbyDeathCallsForRevengeTarget).toHaveLength(1);
  });
});
