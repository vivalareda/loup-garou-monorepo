import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('lobby join validation', () => {
  let mockIo: SocketType;
  let game: Game;
  let segmentsManager: SegmentsManager;
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
    const gameEvents = new GameEvents(
      game,
      segmentsManager,
      mockIo,
      eventsActions
    );
    gameEvents.setupSocketHandlers();

    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
  });

  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);
    return mock;
  };

  it('rejects an empty name', () => {
    const socket = connect('a-sid');
    socket.fire('player:join', '');

    expect(socket.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Invalid name'
    );
    expect(game.getPlayerList().size).toBe(0);
  });

  it('rejects a whitespace-only name', () => {
    const socket = connect('a-sid');
    socket.fire('player:join', '   ');

    expect(socket.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Invalid name'
    );
    expect(game.getPlayerList().size).toBe(0);
  });

  it('rejects a non-string name payload', () => {
    const socket = connect('a-sid');
    socket.fire('player:join', { name: 'Alice' });

    expect(socket.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Invalid name'
    );
    expect(game.getPlayerList().size).toBe(0);
  });

  it('stores the trimmed name', () => {
    const socket = connect('a-sid');
    socket.fire('player:join', '  Alice  ');

    const player = game.getPlayerBySocketId('a-sid');
    expect(player?.getName()).toBe('Alice');
  });

  it('rejects a duplicate name, case- and whitespace-insensitively', () => {
    connect('a-sid').fire('player:join', 'Alice');

    const second = connect('b-sid');
    second.fire('player:join', '  ALICE ');

    expect(second.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Name already taken'
    );
    expect(game.getPlayerList().size).toBe(1);
  });

  it('accepts distinct names normally', () => {
    connect('a-sid').fire('player:join', 'Alice');
    const second = connect('b-sid');
    second.fire('player:join', 'Bob');

    expect(second.socket.emit).not.toHaveBeenCalledWith(
      'lobby:join-rejected',
      expect.anything()
    );
    expect(game.getPlayerList().size).toBe(2);
  });
});

describe('villagers target list', () => {
  it('excludes dead villagers so werewolves cannot target a corpse', () => {
    const mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: vi.fn(),
    } as unknown as SocketType;
    const deathManager = new DeathManager();
    const game = new Game(mockIo, deathManager);

    const alive = game.addPlayer('Alive', 'alive-sid');
    alive.setRole('VILLAGER');
    game.setPlayerTeams(alive);

    const dead = game.addPlayer('Dead', 'dead-sid');
    dead.setRole('VILLAGER');
    game.setPlayerTeams(dead);

    const wolf = game.addPlayer('Wolf', 'wolf-sid');
    wolf.setRole('WEREWOLF');
    game.setPlayerTeams(wolf);

    game.handlePlayerDeath(dead);

    expect(game.getVillagersList()).toEqual([
      { socketId: 'alive-sid', name: 'Alive' },
    ]);
  });
});
