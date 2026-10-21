import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolvePlayerCount } from '@/config';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { SpecialScenarios } from '@/core/special-scenarios';
import type { Broadcaster } from '@/server/broadcaster';
import type { Connection, ConnectionHost } from '@/server/connection';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';

const PLAYER_COUNT_ERROR = /PLAYER_COUNT/;

describe('resolvePlayerCount', () => {
  it('defaults to 6 when PLAYER_COUNT is unset or empty', () => {
    expect(resolvePlayerCount(undefined)).toBe(6);
    expect(resolvePlayerCount('')).toBe(6);
  });

  it('accepts any integer from 4 to 16', () => {
    expect(resolvePlayerCount('4')).toBe(4);
    expect(resolvePlayerCount('8')).toBe(8);
    expect(resolvePlayerCount('16')).toBe(16);
  });

  it('rejects counts out of 4..16 and non-integers with a clear error', () => {
    expect(() => resolvePlayerCount('17')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('3')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('0')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('-1')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('5.5')).toThrow(PLAYER_COUNT_ERROR);
    expect(() => resolvePlayerCount('abc')).toThrow(PLAYER_COUNT_ERROR);
  });
});

/** A lobby of `playerCount` joined players, roles not dealt yet. */
const buildGame = (playerCount: number) => {
  const mockIo = {
    to: vi.fn().mockReturnThis(),
    emit: vi.fn(),
  } satisfies Broadcaster;

  const game = new Game(mockIo, new DeathManager());

  for (let index = 0; index < playerCount; index++) {
    game.addPlayer(`Player${index}`, `socket-${index}`);
  }

  return game;
};

describe('role distribution', () => {
  it.each([4, 5, 6, 8, 16])(
    'deals exactly %i roles with floor(n / 3) werewolves and one HUNTER',
    (playerCount) => {
      const game = buildGame(playerCount);
      game.initRolesList();

      expect(game.availableRoles).toHaveLength(playerCount);
      expect(
        game.availableRoles.filter((role) => role === 'WEREWOLF')
      ).toHaveLength(Math.floor(playerCount / 3));

      // Hunter is now part of normal role generation
      expect(
        game.availableRoles.filter((role) => role === 'HUNTER')
      ).toHaveLength(1);
      // Cupid and Witch are always present for >= 4 players
      expect(
        game.availableRoles.filter((role) => role === 'CUPID')
      ).toHaveLength(1);
      expect(
        game.availableRoles.filter((role) => role === 'WITCH')
      ).toHaveLength(1);

      // The Seer joins from 5 players up; at 4 there is no free slot
      expect(
        game.availableRoles.filter((role) => role === 'SEER')
      ).toHaveLength(playerCount >= 5 ? 1 : 0);

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

  let connectionHandler: ((socket: Connection) => void) | undefined;
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
      socket: socket satisfies Connection,
      fire: (event: string, ...args: unknown[]) =>
        handlers.get(event)?.(...args),
    };
  };

  beforeEach(() => {
    vi.stubEnv('PLAYER_COUNT', '4');

    const mockIo = {
      on: vi.fn((event: string, cb: (socket: Connection) => void) => {
        if (event === 'connection') {
          connectionHandler = cb;
        }
      }),
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } satisfies ConnectionHost;

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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);

    return mock;
  };

  /** `count` players joined, in order, as P1..Pn. */
  const joinPlayers = (count: number) =>
    Array.from({ length: count }, (_, index) => {
      const mock = connect(`p${index + 1}-sid`);
      mock.fire('player:join', `P${index + 1}`);

      return mock;
    });

  /** The count and host of the last `lobby:players-list` sent to `mock`. */
  const lastLobby = (mock: ReturnType<typeof makeMockSocket>) =>
    mock.socket.emit.mock.calls
      .filter(([event]) => event === 'lobby:players-list')
      .at(-1)
      ?.slice(2);

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
      4,
      'p1-sid'
    );
  });

  describe('the host sets the player count', () => {
    let start: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      start = vi.spyOn(segmentsManager, 'startGame');
      vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    });

    it('lets the earliest joined player raise it, and starts at the new count', () => {
      const [host, guest] = joinPlayers(2);
      host.fire('lobby:set-player-count', 6);
      expect(host.socket.emit).not.toHaveBeenCalledWith(
        'alert:action-error',
        expect.anything()
      );

      // Every lobby client hears the new count and who the host is
      guest.fire('lobby:get-players-list');
      expect(lastLobby(guest)).toEqual([6, 'p1-sid']);

      for (let index = 3; index <= 5; index++) {
        connect(`p${index}-sid`).fire('player:join', `P${index}`);
      }

      expect(start).not.toHaveBeenCalled();
      connect('p6-sid').fire('player:join', 'P6');
      expect(start).toHaveBeenCalledTimes(1);
    });

    it('starts at once when lowered to the current headcount', () => {
      const [host] = joinPlayers(1);
      host.fire('lobby:set-player-count', 8);

      for (let index = 2; index <= 5; index++) {
        connect(`p${index}-sid`).fire('player:join', `P${index}`);
      }

      expect(start).not.toHaveBeenCalled();

      host.fire('lobby:set-player-count', 5);
      expect(start).toHaveBeenCalledTimes(1);
      expect(game.getPlayerList().size).toBe(5);
    });

    it('refuses anyone but the host', () => {
      const [, guest] = joinPlayers(2);
      guest.fire('lobby:set-player-count', 6);
      expect(guest.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'Only the host can change the player count'
      );

      // A socket that never joined is not the host of an empty lobby either
      const watcher = connect('watcher-sid');
      watcher.fire('lobby:set-player-count', 6);
      expect(watcher.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'Only the host can change the player count'
      );
    });

    it.each([3, 17, 5.5, '6', null])('refuses the count %s', (count) => {
      const [host] = joinPlayers(1);
      host.fire('lobby:set-player-count', count);
      expect(host.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'Invalid player count'
      );
    });

    it('refuses a count below the players already in', () => {
      const [host] = joinPlayers(1);
      host.fire('lobby:set-player-count', 8);

      for (let index = 2; index <= 5; index++) {
        connect(`p${index}-sid`).fire('player:join', `P${index}`);
      }

      host.fire('lobby:set-player-count', 4);
      expect(host.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'More players have already joined'
      );
      expect(start).not.toHaveBeenCalled();
    });

    it('refuses once the game started', () => {
      const [host] = joinPlayers(4);
      host.fire('lobby:set-player-count', 8);
      expect(host.socket.emit).toHaveBeenCalledWith(
        'alert:action-error',
        'Game already started'
      );
    });

    it('passes the host on when the host leaves the lobby', () => {
      const [host, guest] = joinPlayers(2);
      host.fire('disconnect');
      guest.fire('lobby:set-player-count', 6);
      expect(guest.socket.emit).not.toHaveBeenCalledWith(
        'alert:action-error',
        expect.anything()
      );
    });

    it('keeps the host through a session rejoin on a new socket', () => {
      joinPlayers(2);
      const token = game.getPlayerBySocketId('p1-sid')?.sessionToken ?? '';
      const back = connect('p1-new-sid');
      back.fire('player:rejoin', token);
      back.fire('lobby:set-player-count', 6);
      expect(back.socket.emit).not.toHaveBeenCalledWith(
        'alert:action-error',
        expect.anything()
      );
      back.fire('lobby:get-players-list');
      expect(lastLobby(back)).toEqual([6, 'p1-new-sid']);
    });
  });
});
