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

describe('Night dawn scenarios', () => {
  let game: Game;
  let eventsActions: EventsActions;
  let segmentsManager: SegmentsManager;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn();
    const mockIo = {
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

  it('it should kill partner if lover dies', async () => {
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');
    const player4 = game.addPlayer('Player4', 'mock-id-4');

    player1.setRole('VILLAGER');
    player2.setRole('VILLAGER');
    player3.setRole('WEREWOLF');
    player4.setRole('WEREWOLF');

    game.setPlayerTeams(player1);
    game.setPlayerTeams(player2);
    game.setPlayerTeams(player3);
    game.setPlayerTeams(player4);

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    let deathQueue = game.getDeathQueue();
    expect(deathQueue).toHaveLength(1);

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    await segmentsManager.playSegment();
    await tick();

    deathQueue = game.getDeathQueue();
    expect(deathQueue).toHaveLength(0);
    expect(player1.isAlive).toBe(false);
    expect(player2.isAlive).toBe(false);
  });

  it('should emit hunter pick event if lover is a hunter', async () => {
    const player1 = game.addPlayer('Player1', 'mock-id-1');
    const player2 = game.addPlayer('Player2', 'mock-id-2');
    const player3 = game.addPlayer('Player3', 'mock-id-3');
    const werewolf = game.addPlayer('Werewolf', 'mock-id-4');
    const extraVillager = game.addPlayer('Villager', 'mock-id-5');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    player3.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');
    extraVillager.setRole('VILLAGER');

    game.setPlayerTeams(player1);
    game.setPlayerTeams(player2);
    game.setPlayerTeams(player3);
    game.setPlayerTeams(werewolf);
    game.setPlayerTeams(extraVillager);

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.setSpecialRolePlayer(player2);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    segmentsManager.playSegment();
    await tick();

    expect(emitSpy.mock.calls.map((c) => c[0])).toContain(
      'hunter:pick-required'
    );

    eventsActions.submitHunterPick('mock-id-3');
    await tick();

    // mock-id-1 dies (queued death processed by dayAction);
    // mock-id-3 dies (hunter revenge kill, immediate);
    // mock-id-2 stays alive — isHunterInLove() overwrote mock-id-1's
    // queue cause to PARTNER_SUICIDE, which suppresses the grief-death
    // cascade in processPendingDeaths pass 1. This is a known quirk
    // preserved by the port (same outcome as the old flow).
    expect(player1.isAlive).toBe(false);
    expect(player3.isAlive).toBe(false);
    expect(player2.isAlive).toBe(true);
    expect(game.getDeathQueue()).toHaveLength(0);
  });
});