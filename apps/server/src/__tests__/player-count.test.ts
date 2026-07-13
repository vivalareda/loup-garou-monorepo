import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { resolvePlayerCount } from '@/config';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { SpecialScenarios } from '@/core/special-scenarios';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const PLAYER_COUNT_ERROR = /PLAYER_COUNT/;

describe('resolvePlayerCount', () => {
  it('defaults to 6 when PLAYER_COUNT is unset or empty', () => {
    expect(resolvePlayerCount(undefined)).toBe(6);
    expect(resolvePlayerCount('')).toBe(6);
  });

  it('accepts any integer of at least 4', () => {
    expect(resolvePlayerCount('4')).toBe(4);
    expect(resolvePlayerCount('8')).toBe(8);
  });

  it('rejects counts below 4 and non-integers with a clear error', () => {
    expect(() => resolvePlayerCount('3')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('0')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('-1')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('5.5')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('abc')).toThrow(PLAYER_COUNT_ERROR);
  });
});

describe('role distribution', () => {
  const buildGame = (playerCount: number) => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;
    const game = new Game(mockIo, new DeathManager());
    for (let index = 0; index < playerCount; index++) {
      game.addPlayer(`Player${index}`, `socket-${index}`);
    }
    return game;
  };

  it.each([4, 5, 6, 8])(
    'deals exactly %i roles with floor(n / 3) werewolves',
    (playerCount) => {
      const game = buildGame(playerCount);
      game.initRolesList();

      expect(game.availableRoles).toHaveLength(playerCount);
      expect(
        game.availableRoles.filter((role) => role === 'WEREWOLF')
      ).toHaveLength(Math.floor(playerCount / 3));

      // Every player ends up with exactly one role
      game.assignRoles();
      for (const player of game.getPlayerList().values()) {
        expect(player.role).not.toBeNull();
      }
    }
  );
});

describe('PLAYER_COUNT driven auto-start', () => {
  type Handler = (...args: unknown[]) => void;
  let connectionHandler:
    | ((socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void)
    | undefined;
  let game: Game;
  let segmentsManager: SegmentsManager;

  const makeMockSocket = (id: string) => {
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
      fire: (event: string, ...args: unknown[]) =>
        handlers.get(event)?.(...args),
    };
  };

  beforeEach(() => {
    vi.stubEnv('PLAYER_COUNT', '4');

    const mockIo = {
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
    new GameEvents(game, segmentsManager, mockIo, eventsActions)
      .setupSocketHandlers();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);
    return mock;
  };

  it('auto-starts once the configured number of players joined', () => {
    const start = vi.spyOn(segmentsManager, 'startGame');
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);

    const sockets = Array.from({ length: 5 }, (_, index) =>
      connect(`p${index + 1}-sid`)
    );
    for (let index = 0; index < 3; index++) {
      sockets[index].fire('player:join', `P${index + 1}`);
    }
    expect(start).not.toHaveBeenCalled();

    sockets[3].fire('player:join', 'P4');
    expect(start).toHaveBeenCalledTimes(1);
    expect(game.getPlayerList().size).toBe(4);

    // A fifth join after auto-start is rejected
    sockets[4].fire('player:join', 'P5');
    expect(sockets[4].socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Game already started'
    );
  });

  it('sends the required player count with the lobby players list', () => {
    const mock = connect('p1-sid');
    mock.fire('player:join', 'P1');
    mock.fire('lobby:get-players-list');

    expect(mock.socket.emit).toHaveBeenCalledWith(
      'lobby:players-list',
      [expect.objectContaining({ name: 'P1', socketId: 'p1-sid' })],
      4
    );
  });
});
