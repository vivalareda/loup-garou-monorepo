import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { SpecialScenarios } from '@/core/special-scenarios';
import type { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

describe('Scenario tests', () => {
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
      playSecondLoverIsHunterAudio: vi.fn(),
    } as unknown as AudioManager;

    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      mockAudioManager,
      mockSpecialScenarios
    );

    eventsActions = new EventsActions(game, segmentsManager);
  });

  it('it should kill partner if lover dies', async () => {
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');
    const player4 = game.addPlayer('Player4', 'mock-id-4');

    player1.setRole('VILLAGER');
    player2.setRole('VILLAGER');
    player3.setRole('WEREWOLF');
    player4.setRole('WEREWOLF');

    // Add players to teams so game knows who's alive
    game.setPlayerTeams(player1);
    game.setPlayerTeams(player2);
    game.setPlayerTeams(player3);
    game.setPlayerTeams(player4);

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    vi.spyOn(segmentsManager, 'isHunterInDeathQueue').mockReturnValue(false);

    // Check death queue BEFORE processing
    let deathQueue = game.getDeathQueue();
    expect(deathQueue).toHaveLength(1);

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    await segmentsManager.playSegment(); // Make it async

    // Check death queue AFTER processing
    deathQueue = game.getDeathQueue();

    expect(deathQueue).toHaveLength(0); // Should be empty after processing
    expect(player1.isAlive).toBe(false);
    expect(player2.isAlive).toBe(false);
  });

  it('it should kill hunters lover when hunter dies', () => {
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
    expect(mockAudioManager.playVillagersWonAudio).toHaveBeenCalled();
  });

  it('should emit hunter pick event if lover is a hunter', () => {
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    player3.setRole('VILLAGER');

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.setSpecialRolePlayer(player2);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    // Spy on the real specialScenarios instance instead of mocking
    const partnerIsHunterSpy = vi.spyOn(
      segmentsManager.specialScenarios,
      'partnerIsHunter'
    );

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    segmentsManager.playSegment();

    expect(partnerIsHunterSpy).toHaveBeenCalled();
  });
});
