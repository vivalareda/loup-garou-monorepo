import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
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

describe('in-place game restart', () => {
  let mockIo: SocketType;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let gameEvents: GameEvents;
  let connectionHandler:
    | ((socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void)
    | undefined;

  beforeEach(() => {
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
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
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
    gameEvents = new GameEvents(game, segmentsManager, mockIo, eventsActions);
    gameEvents.setupSocketHandlers();
  });

  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);
    return mock;
  };

  const markFinished = () => {
    (segmentsManager as unknown as { gameFinished: boolean }).gameFinished =
      true;
  };

  it('rejects game:restart while a game is still running', () => {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    const sockets = Array.from({ length: 6 }, (_, index) =>
      connect(`p${index + 1}-sid`)
    );
    for (const [index, mock] of sockets.entries()) {
      mock.fire('player:join', `P${index + 1}`);
    }
    expect(segmentsManager.hasStarted()).toBe(true);

    sockets[0].fire('game:restart');

    expect(sockets[0].socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Game is not finished'
    );
    expect(mockIo.emit).not.toHaveBeenCalledWith('game:restarted');
    expect(game.getPlayerList().size).toBe(6);
  });

  it('plays two consecutive full lifecycles over the same sockets', () => {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    const start = vi.spyOn(segmentsManager, 'startGame');

    // --- Game 1: join, auto-start, kill someone, finish
    const sockets = Array.from({ length: 6 }, (_, index) =>
      connect(`p${index + 1}-sid`)
    );
    for (const [index, mock] of sockets.entries()) {
      mock.fire('player:join', `P${index + 1}`);
    }
    expect(start).toHaveBeenCalledTimes(1);

    const victim = game.getPlayerBySocketId('p1-sid');
    expect(victim).toBeDefined();
    if (victim) {
      game.handlePlayerDeath(victim);
    }
    markFinished();

    // --- Any player may trigger the restart, including a dead one
    sockets[0].fire('game:restart');

    expect(mockIo.emit).toHaveBeenCalledWith('game:restarted');
    expect(game.getPlayerList().size).toBe(0);
    expect(game.getLovers()).toHaveLength(0);
    expect(game.getDeathQueue()).toHaveLength(0);
    expect(segmentsManager.getCurrentSegmentType()).toBe('LOBBY');
    expect(segmentsManager.hasFinished()).toBe(false);

    // --- Game 2 over the exact same sockets: handlers were never
    // re-registered, joins flow through the same objects and auto-start
    // fires again
    for (const [index, mock] of sockets.entries()) {
      mock.fire('player:join', `P${index + 1}`);
    }

    expect(start).toHaveBeenCalledTimes(2);
    expect(game.getPlayerList().size).toBe(6);
    expect(segmentsManager.hasStarted()).toBe(true);
    for (const player of game.getPlayerList().values()) {
      expect(player.role).not.toBeNull();
      expect(player.isAlive).toBe(true);
    }
  });

  it('gameplay events after restart target the new game state, not the old', () => {
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    const sockets = Array.from({ length: 6 }, (_, index) =>
      connect(`p${index + 1}-sid`)
    );
    for (const [index, mock] of sockets.entries()) {
      mock.fire('player:join', `P${index + 1}`);
    }
    markFinished();
    sockets[0].fire('game:restart');

    // A stale action from the finished game must not corrupt the lobby
    const setLovers = vi.spyOn(game, 'setLovers');
    sockets[1].fire('cupid:lovers-pick', ['p3-sid', 'p4-sid']);
    expect(setLovers).not.toHaveBeenCalled();
  });
});
