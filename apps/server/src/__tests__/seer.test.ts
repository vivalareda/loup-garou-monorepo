import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';
import type { SocketType } from '@/server/sockets';

vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

type Handler = (...args: unknown[]) => void;

function makeMockSocket(id: string) {
  const handlers = new Map<string, Handler>();
  const socket = {
    id,
    on: vi.fn((event: string, cb: Handler) => {
      handlers.set(event, cb);
      return socket;
    }),
    emit: vi.fn(),
    broadcast: { emit: vi.fn() },
  };
  return {
    socket: socket as unknown as Socket<
      ClientToServerEvents,
      ServerToClientEvents
    >,
    fire: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
  };
}

describe('Seer phase', () => {
  let mockIo: SocketType;
  let ioEmit: ReturnType<typeof vi.fn>;
  let ioTo: ReturnType<typeof vi.fn>;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let connectionHandler:
    | ((socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void)
    | undefined;

  beforeEach(() => {
    ioEmit = vi.fn();
    ioTo = vi.fn().mockReturnThis();
    mockIo = {
      on: vi.fn(
        (
          event: string,
          cb: (
            socket: Socket<ClientToServerEvents, ServerToClientEvents>
          ) => void
        ) => {
          if (event === 'connection') {
            connectionHandler = cb;
          }
        }
      ),
      to: ioTo,
      emit: ioEmit,
      removeAllListeners: vi.fn(),
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
    const eventsActions = new EventsActions(game, segmentsManager, mockIo);
    new GameEvents(
      game,
      segmentsManager,
      mockIo,
      eventsActions
    ).setupSocketHandlers();
  });

  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);
    return mock;
  };

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<Player['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);
    if (role !== 'WEREWOLF' && role !== 'VILLAGER') {
      game.setSpecialRolePlayer(player);
    }
    return player;
  };

  const setSegment = (type: string) => {
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted = true;
    const index = segmentsManager.segments.findIndex(
      (segment) => segment.type === type
    );
    segmentsManager.currentSegment = index;
  };

  it('prompts only the seer when the segment plays', () => {
    addPlayer('Seer', 'seer-sid', 'SEER');
    addPlayer('A', 'a-sid', 'VILLAGER');

    segmentsManager.getGameActions().seerAction();

    expect(ioTo).toHaveBeenCalledWith('seer-sid');
    expect(ioTo).not.toHaveBeenCalledWith('a-sid');
  });

  it('returns the target role privately and advances the segment', () => {
    addPlayer('Seer', 'seer-sid', 'SEER');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('SEER');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    const seerSocket = connect('seer-sid');
    seerSocket.fire('seer:picked-player', 'wolf-sid');

    expect(seerSocket.socket.emit).toHaveBeenCalledWith(
      'seer:vision-result',
      'Wolf',
      'WEREWOLF'
    );
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('rejects a pick from a player who is not the seer', () => {
    addPlayer('Seer', 'seer-sid', 'SEER');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    setSegment('SEER');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    const wolfSocket = connect('wolf-sid');
    wolfSocket.fire('seer:picked-player', 'seer-sid');

    expect(wolfSocket.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Seer action is not allowed now'
    );
    expect(finish).not.toHaveBeenCalled();
  });

  it('rejects a pick outside the SEER segment', () => {
    addPlayer('Seer', 'seer-sid', 'SEER');
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('WEREWOLF');

    const seerSocket = connect('seer-sid');
    seerSocket.fire('seer:picked-player', 'a-sid');

    expect(seerSocket.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Seer action is not allowed now'
    );
  });

  it('rejects dead, unknown, and self targets', () => {
    addPlayer('Seer', 'seer-sid', 'SEER');
    const dead = addPlayer('Dead', 'dead-sid', 'VILLAGER');
    dead.setIsAlive(false);
    setSegment('SEER');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    const seerSocket = connect('seer-sid');
    for (const target of ['dead-sid', 'nobody-sid', 'seer-sid']) {
      seerSocket.fire('seer:picked-player', target);
      expect(seerSocket.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'Invalid Seer target'
      );
    }
    expect(finish).not.toHaveBeenCalled();
  });

  it('auto-skips the segment when the seer is dead', async () => {
    const seer = addPlayer('Seer', 'seer-sid', 'SEER');
    addPlayer('A', 'a-sid', 'VILLAGER');
    seer.setIsAlive(false);
    setSegment('SEER');
    const advance = vi
      .spyOn(segmentsManager, 'advanceSegment')
      .mockResolvedValue(undefined);

    await segmentsManager.playSegment();

    expect(advance).toHaveBeenCalledWith({ playEndAudio: false });
  });

  it('auto-skips the segment when no seer exists', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('SEER');
    const advance = vi
      .spyOn(segmentsManager, 'advanceSegment')
      .mockResolvedValue(undefined);

    await segmentsManager.playSegment();

    expect(advance).toHaveBeenCalledWith({ playEndAudio: false });
  });

  it('runs every night, unlike the first-night-only Cupid and Lovers segments', () => {
    const seerSegment = segmentsManager.segments.find(
      (segment) => segment.type === 'SEER'
    );
    expect(seerSegment).toBeDefined();
    if (!seerSegment) {
      return;
    }
    segmentsManager.markFirstNightSegment(seerSegment);
    expect(seerSegment.skip).toBe(false);
  });
});
