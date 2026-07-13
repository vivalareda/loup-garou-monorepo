import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';
import { SpecialScenarios } from '@/core/special-scenarios';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

/**
 * Drive the real GameEvents socket-handler wiring by capturing the
 * io.on('connection', cb) callback and feeding it a mock socket whose
 * .on(event, cb) registrations land in a map we can invoke by name.
 */
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
    socket: socket as unknown as Socket<ClientToServerEvents, ServerToClientEvents>,
    fire: (event: string, ...args: unknown[]) => handlers.get(event)?.(...args),
    has: (event: string) => handlers.has(event),
  };
}

describe('Server-side role validation', () => {
  let mockIo: SocketType;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;
  let gameEvents: GameEvents;
  let connectionHandler:
    | ((socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void)
    | undefined;

  const addPlayer = (
    name: string,
    sid: string,
    role: Parameters<Player['setRole']>[0]
  ) => {
    const player = game.addPlayer(name, sid);
    player.setRole(role);
    game.setPlayerTeams(player);
    if (role === 'HUNTER' || role === 'WITCH' || role === 'CUPID') {
      game.setSpecialRolePlayer(player);
    }
    return player;
  };

  beforeEach(() => {
    const ioOn = vi.fn(
      (
        event: string,
        cb: (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void
      ) => {
        if (event === 'connection') {
          connectionHandler = cb;
        }
      }
    );
    mockIo = {
      on: ioOn,
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
    eventsActions = new EventsActions(game, segmentsManager, mockIo);
    gameEvents = new GameEvents(game, segmentsManager, mockIo, eventsActions);
    gameEvents.setupSocketHandlers();

    // sanity: the connection handler was captured
    expect(connectionHandler).toBeDefined();
  });

  // A connected socket, wired through the real handler registrations.
  const connect = (sid: string) => {
    const mock = makeMockSocket(sid);
    connectionHandler?.(mock.socket);
    return mock;
  };

  const setSegment = (type: string) => {
    (
      segmentsManager as unknown as { gameStarted: boolean }
    ).gameStarted = true;
    const index = segmentsManager.segments.findIndex((segment) => segment.type === type);
    if (index !== -1) {
      segmentsManager.currentSegment = index;
    }
  };

  it('cupid:lovers-pick from a non-cupid socket does not set lovers', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'setLovers');
    attacker.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).not.toHaveBeenCalled();
  });

  it('cupid:lovers-pick from the real cupid sets lovers', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const cupid = connect('cupid-sid');

    const spy = vi.spyOn(game, 'setLovers');
    vi.spyOn(segmentsManager, 'finishSegment').mockResolvedValue(undefined);
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).toHaveBeenCalledWith(['p2-sid', 'p3-sid']);
  });

  it('cupid:lovers-pick rejects duplicate, missing, dead, and self targets', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    const p2 = addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const cupid = connect('cupid-sid');
    const spy = vi.spyOn(game, 'setLovers');

    cupid.fire('cupid:lovers-pick', ['p2-sid']);
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p2-sid']);
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'missing-sid']);
    cupid.fire('cupid:lovers-pick', ['cupid-sid', 'p2-sid']);
    p2.isAlive = false;
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).not.toHaveBeenCalled();
  });

  it('cupid:lovers-pick is ignored outside the Cupid segment', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const cupid = connect('cupid-sid');
    const spy = vi.spyOn(game, 'setLovers');

    segmentsManager.currentSegment = 2;
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).not.toHaveBeenCalled();
  });

  it('lover acknowledgements must come once from each selected lover', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const cupid = connect('cupid-sid');
    const lover1 = connect('p2-sid');
    const lover2 = connect('p3-sid');
    const attacker = connect('attacker-sid');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);
    finish.mockClear();
    setSegment('LOVERS');

    attacker.fire('alert:lover-closed-alert');
    lover1.fire('alert:lover-closed-alert');
    lover1.fire('alert:lover-closed-alert');
    expect(finish).not.toHaveBeenCalled();

    lover2.fire('alert:lover-closed-alert');
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('witch:healed-player from a non-witch socket does not heal', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    setSegment('WITCH-HEAL');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'healWerewolfVictim');
    attacker.fire('witch:healed-player');

    expect(spy).not.toHaveBeenCalled();
  });

  it('witch:poisoned-player from a non-witch socket does not poison', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('WITCH-POISON');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'witchKill');
    attacker.fire('witch:poisoned-player', 'p2-sid');

    expect(spy).not.toHaveBeenCalled();
  });

  it('witch:skipped-heal from a non-witch socket does not finish the segment', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    setSegment('WITCH-HEAL');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(segmentsManager, 'finishSegment');
    attacker.fire('witch:skipped-heal');

    expect(spy).not.toHaveBeenCalled();
  });

  it('hunter:killed-player from a non-hunter socket is not forwarded', () => {
    addPlayer('Hunter', 'hunter-sid', 'HUNTER');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(eventsActions, 'submitHunterPick');
    attacker.fire('hunter:killed-player', 'p2-sid');

    expect(spy).not.toHaveBeenCalled();
  });

  it('hunter:killed-player rejects nonexistent, dead, and hunter targets', () => {
    addPlayer('Hunter', 'hunter-sid', 'HUNTER');
    const dead = addPlayer('Dead', 'dead-sid', 'VILLAGER');
    const otherHunter = game.addPlayer('OtherHunter', 'other-hunter-sid');
    otherHunter.setRole('HUNTER');
    game.setPlayerTeams(otherHunter);
    dead.isAlive = false;
    const hunter = connect('hunter-sid');
    const spy = vi.spyOn(eventsActions, 'submitHunterPick');

    hunter.fire('hunter:killed-player', 'missing-sid');
    hunter.fire('hunter:killed-player', 'dead-sid');
    hunter.fire('hunter:killed-player', 'other-hunter-sid');

    expect(spy).not.toHaveBeenCalled();
  });

  it('day:player-voted from a dead voter is not counted', async () => {
    const a = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('C', 'c-sid', 'WEREWOLF');
    addPlayer('D', 'd-sid', 'WEREWOLF');
    setSegment('DAY');
    // Kill the voter before voting
    a.isAlive = false;

    const voter = connect('a-sid');
    const spy = vi.spyOn(game, 'handleDayVote');
    voter.fire('day:player-voted', 'b-sid');

    // handleDayVote is async; let microtasks flush
    await Promise.resolve();

    expect(spy).not.toHaveBeenCalled();
  });

  it('day:player-voted targeting a dead/nonexistent player is not counted', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    const target = addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('C', 'c-sid', 'WEREWOLF');
    addPlayer('D', 'd-sid', 'WEREWOLF');
    setSegment('DAY');
    target.isAlive = false;

    const voter = connect('a-sid');
    const spy = vi.spyOn(game, 'handleDayVote');
    voter.fire('day:player-voted', 'b-sid');

    await Promise.resolve();

    expect(spy).not.toHaveBeenCalled();
  });

  it('day:player-voted from a live voter targeting a live player is counted', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('C', 'c-sid', 'WEREWOLF');
    addPlayer('D', 'd-sid', 'WEREWOLF');
    setSegment('DAY');

    const voter = connect('a-sid');
    const spy = vi.spyOn(game, 'handleDayVote');
    voter.fire('day:player-voted', 'b-sid');

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith('a-sid', 'b-sid');
  });

  it('rejects stale gameplay actions from old phases', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('DAY');

    const cupid = connect('cupid-sid');
    const witch = connect('witch-sid');
    const wolf = connect('wolf-sid');
    const spyFinish = vi.spyOn(segmentsManager, 'finishSegment');
    const spyWerewolf = vi.spyOn(eventsActions, 'handleWerewolfVote');

    cupid.fire('cupid:lovers-pick', ['a-sid', 'b-sid']);
    witch.fire('witch:skipped-heal');
    wolf.fire('werewolf:player-voted', 'a-sid');

    expect(game.getLovers()).toHaveLength(0);
    expect(spyFinish).not.toHaveBeenCalled();
    expect(spyWerewolf).not.toHaveBeenCalled();
  });

  it('rejects duplicate join submissions from one socket', () => {
    const player = connect('p1-sid');

    player.fire('player:join', 'Alice');
    player.fire('player:join', 'Alice Again');

    expect(game.getPlayerList().size).toBe(1);
    expect(player.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Player already joined'
    );
  });

  it('rejects a seventh player and join-after-start without starting again', () => {
    const sockets = Array.from({ length: 7 }, (_, index) =>
      connect(`p${index + 1}-sid`)
    );
    const start = vi.spyOn(segmentsManager, 'startGame');

    for (let index = 0; index < 6; index++) {
      sockets[index].fire('player:join', `P${index + 1}`);
    }
    sockets[6].fire('player:join', 'P7');

    expect(start).toHaveBeenCalledTimes(1);
    expect(game.getPlayerList().size).toBe(6);
    expect(sockets[6].socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Game already started'
    );
  });

  it('rejects duplicate admin start', () => {
    const admin = connect('admin-sid');
    const start = vi.spyOn(segmentsManager, 'startGame');
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);

    admin.fire('admin:start-game');
    admin.fire('admin:start-game');

    expect(start).toHaveBeenCalledTimes(1);
    expect(admin.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Game already started'
    );
  });

  it('resets per-game state for a new game with the same sockets', () => {
    const player = addPlayer('A', 'a-sid', 'WITCH');
    addPlayer('B', 'b-sid', 'WEREWOLF');
    game.setLovers(['a-sid', 'b-sid']);
    game.handlePlayerDeath(player);
    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
    segmentsManager.startGame();

    game.resetForNewGame();
    segmentsManager.resetForNewGame();

    expect(game.getPlayerList().size).toBe(2);
    expect(player.isAlive).toBe(true);
    expect(player.role).toBeNull();
    expect(game.getLovers()).toHaveLength(0);
    expect(segmentsManager.getCurrentSegmentType()).toBe('LOBBY');
  });

  it('rejoins an existing player with a session token and sends a safe snapshot', () => {
    const firstSocket = connect('old-sid');
    firstSocket.fire('player:join', 'Alice');
    const token = game.getPlayerBySocketId('old-sid')?.sessionToken;
    expect(token).toBeDefined();

    const newSocket = connect('new-sid');
    newSocket.fire('player:rejoin', token);

    expect(game.getPlayerBySocketId('old-sid')).toBeUndefined();
    expect(game.getPlayerBySocketId('new-sid')?.getName()).toBe('Alice');
    expect(newSocket.socket.emit).toHaveBeenCalledWith(
      'game:snapshot',
      expect.objectContaining({
        phase: 'LOBBY',
        self: expect.objectContaining({
          name: 'Alice',
          socketId: 'new-sid',
        }),
      })
    );
  });
});
