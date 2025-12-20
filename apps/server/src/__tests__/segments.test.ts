/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import type { SocketType } from '@/server/sockets';

describe('Audio segment order', () => {
  let mockIo: SocketType;
  let game: Game;
  let deathManager: DeathManager;
  let audioManager: AudioManager;
  let segmentsManager: SegmentsManager;
  let specialScenarios: SpecialScenarios;

  beforeEach(() => {
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;

    deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
    audioManager = new AudioManager(deathManager);
    specialScenarios = new SpecialScenarios(game, audioManager);

    // audioManager.playSegmentAudio = vi.fn().mockResolvedValue(undefined);
    audioManager.playVillagersWonAudio = vi.fn().mockResolvedValue(undefined);
    audioManager.playWerewolvesWonAudio = vi.fn().mockResolvedValue(undefined);
    audioManager.playHunterAudio = vi.fn().mockResolvedValue(undefined);
    audioManager.playLoverAudio = vi.fn().mockResolvedValue(undefined);

    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      audioManager,
      specialScenarios
    );

    // eventsActions = new EventsActions(game, segmentsManager, mockIo);
  });

  describe('First Night Segments', () => {
    it('should play cupid segment when a game start', async () => {
      game.addPlayer('Player1', 'socket-1');
      game.addPlayer('Player2', 'socket-2');
      game.addPlayer('Player3', 'socket-3');
      game.addPlayer('Player4', 'socket-4');

      game.assignRoles();

      segmentsManager.startGame();

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(segmentsManager.getCurrentSegmentType()).toBe('CUPID');
      expect(audioManager.playSegmentAudio).toHaveBeenCalledWith('CUPID', true);
    });
  });

  describe('Death audio sequences', () => {
    it('should play: wake-up → death announcement → day-vote-start when there are deaths', async () => {
      game.addPlayer('Player1', 'socket-1');
      game.addPlayer('Player2', 'socket-2');
      game.addPlayer('Player3', 'socket-3');
      game.addPlayer('Player4', 'socket-4');

      game.assignRoles();
      const players = Array.from(game.getPlayerList().values());
      game.setLovers([players[0].getSocketId(), players[1].getSocketId()]);

      for (const player of players) {
        game.setPlayerTeams(player);
      }

      const daySegmentIndex = segmentsManager.segments.findIndex(
        (s) => s.type === 'DAY'
      );
      segmentsManager.currentSegment = daySegmentIndex;

      game.addPendingDeath(players[2].getSocketId(), 'WEREWOLVES');

      const playAudioSpy = vi.spyOn(audioManager, 'playAudio');

      await segmentsManager.playSegment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      const calls = playAudioSpy.mock.calls.map((call) => call[0]);

      expect(calls).toEqual([
        'Night-end/Wake-up-everyone',
        'Night-end/Deaths',
        'Segment-transition/day-vote-start',
      ]);
    });

    it('should play: wake-up → no-deaths → day-vote-start when there are NO deaths', async () => {
      game.addPlayer('Player1', 'socket-1');
      game.addPlayer('Player2', 'socket-2');
      game.addPlayer('Player3', 'socket-3');
      game.addPlayer('Player4', 'socket-4');

      game.assignRoles();
      const players = Array.from(game.getPlayerList().values());
      game.setLovers([players[0].getSocketId(), players[1].getSocketId()]);

      for (const player of players) {
        game.setPlayerTeams(player);
      }

      const daySegmentIndex = segmentsManager.segments.findIndex(
        (s) => s.type === 'DAY'
      );
      segmentsManager.currentSegment = daySegmentIndex;

      const audioManagerSpy = vi.spyOn(audioManager, 'playSegmentAudio');

      await segmentsManager.playSegment();
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(audioManagerSpy).toHaveBeenCalledWith('DAY', true);
    });
  });
});
