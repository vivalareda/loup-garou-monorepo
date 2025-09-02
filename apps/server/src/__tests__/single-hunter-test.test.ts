import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

describe('Single Hunter Test', () => {
  let game: Game;
  let eventsActions: EventsActions;
  let segmentsManager: SegmentsManager;
  let deathManager: DeathManager;
  let mockAudioManager: AudioManager;
  let mockSpecialScenarios: SpecialScenarios;

  beforeEach(() => {
    // Mock socket.io
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    mockSpecialScenarios = {
      secondLoverIsHunter: vi.fn(),
      partnerIsHunter: vi.fn(),
    } as unknown as SpecialScenarios;

    // Create instances
    deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);

    // Mock audio manager (no actual audio in tests)
    mockAudioManager = {
      playSegmentAudio: vi.fn(),
      playHunterAudio: vi.fn(),
      playSpecialScenarioAudio: vi.fn(),
      playWinnerAudio: vi.fn(),
      playPostHunterAudio: vi.fn(),
      playVillagersWonAudio: vi.fn(),
      playLoverAudio: vi.fn(),
    } as unknown as AudioManager;

    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      mockAudioManager,
      mockSpecialScenarios
    );

    eventsActions = new EventsActions(game, segmentsManager);
  });

  it('should kill partner when lover (who is hunter) dies', () => {
    // Setup - mirrors runWerewolfKillLoverWhoIsHunter()
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');

    player1.setRole('HUNTER');
    game.setSpecialRolePlayer(player1);
    player2.setRole('VILLAGER');
    player3.setRole('VILLAGER');

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    // Act - Hunter picks target
    eventsActions.handleHunterPlayerPick('mock-id-3');

    // Assert - Check death queue has correct entries
    const deathQueue = game.getDeathQueue();
    expect(deathQueue).toHaveLength(3);
    expect(deathQueue).toEqual(
      expect.arrayContaining([
        { playerId: 'mock-id-1', cause: 'WEREWOLVES' },
        {
          playerId: 'mock-id-3',
          cause: 'HUNTER_REVENGE',
          metadata: { hunterId: 'mock-id-1' },
        },
        { playerId: 'mock-id-2', cause: 'PARTNER_SUICIDE' },
      ])
    );

    // Verify players are still alive (deaths are queued, not processed yet)
    expect(player1.isAlive).toBe(true);
    expect(player2.isAlive).toBe(true);
    expect(player3.isAlive).toBe(true);
  });

  it('should trigger hunter revenge when lover dies and partner is hunter', () => {
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    player3.setRole('VILLAGER');

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.setSpecialRolePlayer(player2);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    // Mock to skip hunter death queue check (hunter is NOT in death queue)
    vi.spyOn(segmentsManager, 'isHunterInDeathQueue').mockReturnValue(false);

    // Find DAY segment dynamically
    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    segmentsManager.playSegment();

    expect(mockSpecialScenarios.partnerIsHunter).toHaveBeenCalled();
  });
});
