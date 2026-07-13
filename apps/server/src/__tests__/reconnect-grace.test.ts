import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ClientToServerEvents,
  PlayerGameSnapshot,
  ServerToClientEvents,
} from '@repo/types';
import type { Socket } from 'socket.io';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import type { Player } from '@/core/player';
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

const GRACE_MS = 90_000;

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

describe('disconnect grace period and reconnection', () => {
  let mockIo: SocketType;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;
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
    eventsActions = new EventsActions(game, segmentsManager, mockIo);
    gameEvents = new GameEvents(game, segmentsManager, mockIo, eventsActions);
    gameEvents.setupSocketHandlers();

    vi.spyOn(segmentsManager, 'playSegment').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted =
      true;
    const index = segmentsManager.segments.findIndex(
      (segment) => segment.type === type
    );
    if (index !== -1) {
      segmentsManager.currentSegment = index;
    }
  };

  it('does not kill a player when their socket drops mid-game', () => {
    vi.useFakeTimers();
    const player = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'WEREWOLF');
    setSegment('WEREWOLF');
    const socket = connect('a-sid');

    socket.fire('disconnect');

    expect(player.isAlive).toBe(true);
    expect(player.isConnected).toBe(false);
  });

  it('treats the disconnect as a death once the grace period expires', () => {
    vi.useFakeTimers();
    const player = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'WEREWOLF');
    setSegment('WEREWOLF');
    const socket = connect('a-sid');

    socket.fire('disconnect');
    vi.advanceTimersByTime(GRACE_MS);

    expect(player.isAlive).toBe(false);
  });

  it('keeps a player alive when they reconnect within the grace period', () => {
    vi.useFakeTimers();
    const player = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'WEREWOLF');
    setSegment('WEREWOLF');
    const socket = connect('a-sid');

    socket.fire('disconnect');
    const newSocket = connect('a-new-sid');
    newSocket.fire('player:rejoin', player.sessionToken);
    vi.advanceTimersByTime(GRACE_MS * 2);

    expect(player.isAlive).toBe(true);
    expect(player.isConnected).toBe(true);
    expect(player.getSocketId()).toBe('a-new-sid');
    expect(newSocket.socket.emit).toHaveBeenCalledWith(
      'game:snapshot',
      expect.objectContaining({ phase: 'WEREWOLF' })
    );
  });

  it('remaps votes that referenced the old socket ID on reconnect', () => {
    const wolf = addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    const target = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    const wolfSocket = connect('wolf-sid');
    connect('a-sid');

    wolfSocket.fire('werewolf:player-voted', 'a-sid');

    // Both the voter and the target reconnect on new sockets
    const newWolfSocket = connect('wolf-new-sid');
    newWolfSocket.fire('player:rejoin', wolf.sessionToken);
    const newTargetSocket = connect('a-new-sid');
    newTargetSocket.fire('player:rejoin', target.sessionToken);

    // The second wolf agreeing must complete the vote against the NEW sid
    const wolf2Socket = connect('wolf2-sid');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);
    wolf2Socket.fire('werewolf:player-voted', 'a-new-sid');

    expect(game.getWerewolfTarget()).toBe('a-new-sid');
    expect(finish).toHaveBeenCalled();
  });

  it('completes the werewolf vote when the missing werewolf disconnects', () => {
    vi.useFakeTimers();
    addPlayer('Wolf1', 'wolf1-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    const wolf1Socket = connect('wolf1-sid');
    const wolf2Socket = connect('wolf2-sid');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    wolf1Socket.fire('werewolf:player-voted', 'a-sid');
    expect(finish).not.toHaveBeenCalled();

    wolf2Socket.fire('disconnect');

    expect(finish).toHaveBeenCalledTimes(1);
    expect(game.getWerewolfTarget()).toBe('a-sid');
  });

  it('completes the day vote when the last missing voter disconnects', async () => {
    addPlayer('Wolf1', 'wolf1-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    const victim = addPlayer('E', 'e-sid', 'VILLAGER');
    setSegment('DAY');
    const sockets = ['wolf1-sid', 'wolf2-sid', 'a-sid', 'b-sid'].map(connect);
    const lateSocket = connect('e-sid');

    for (const socket of sockets) {
      socket.fire('day:player-voted', 'e-sid');
    }
    await Promise.resolve();
    expect(victim.isAlive).toBe(true);

    // E never votes — their disconnect is what completes the vote
    lateSocket.fire('disconnect');

    await vi.waitFor(() => {
      expect(victim.isAlive).toBe(false);
    });
  });

  it('advances a Witch phase when the witch dies through grace expiry', () => {
    vi.useFakeTimers();
    const witch = addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('WITCH-HEAL');
    const witchSocket = connect('witch-sid');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    witchSocket.fire('disconnect');
    // Still within grace: the witch may come back and act
    expect(finish).not.toHaveBeenCalled();

    vi.advanceTimersByTime(GRACE_MS);

    expect(witch.isAlive).toBe(false);
    expect(finish).toHaveBeenCalled();
  });

  it('sends a reconnecting witch her pending heal prompt without leaking roles', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    const victim = addPlayer('A', 'a-sid', 'VILLAGER');
    game.handleWerewolfVote('wolf-sid', 'a-sid');
    setSegment('WITCH-HEAL');

    const witch = game.getPlayerBySocketId('witch-sid');
    expect(witch).toBeDefined();
    if (!witch) {
      return;
    }
    const snapshot: PlayerGameSnapshot = gameEvents.buildSnapshotFor(witch);

    expect(snapshot.pendingPrompt).toEqual({
      kind: 'WITCH-HEAL',
      victimSid: 'a-sid',
      victimName: victim.getName(),
    });
    // The roster never carries roles — only the player's own `self` does
    for (const rosterEntry of snapshot.players) {
      expect(rosterEntry).not.toHaveProperty('role');
    }
  });

  it('rebuilds the pending prompt for every input phase', () => {
    const cupid = addPlayer('Cupid', 'cupid-sid', 'CUPID');
    const witch = addPlayer('Witch', 'witch-sid', 'WITCH');
    const hunter = addPlayer('Hunter', 'hunter-sid', 'HUNTER');
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    const villager = addPlayer('A', 'a-sid', 'VILLAGER');

    setSegment('CUPID');
    expect(gameEvents.buildSnapshotFor(cupid).pendingPrompt).toEqual({
      kind: 'CUPID',
    });
    // Only Cupid is prompted during the Cupid phase
    expect(gameEvents.buildSnapshotFor(villager).pendingPrompt).toBeUndefined();

    setSegment('WITCH-POISON');
    expect(gameEvents.buildSnapshotFor(witch).pendingPrompt).toEqual({
      kind: 'WITCH-POISON',
    });

    setSegment('DAY');
    expect(gameEvents.buildSnapshotFor(villager).pendingPrompt).toEqual({
      kind: 'DAY-VOTE',
    });
    // A voter who already voted is not re-prompted
    game.handleDayVote('a-sid', 'wolf-sid');
    expect(gameEvents.buildSnapshotFor(villager).pendingPrompt).toBeUndefined();

    // A hunter reconnecting while a revenge pick is pending gets HUNTER,
    // not DAY-VOTE
    vi.spyOn(eventsActions, 'hasPendingHunterPick').mockReturnValue(true);
    expect(gameEvents.buildSnapshotFor(hunter).pendingPrompt).toEqual({
      kind: 'HUNTER',
    });
  });

  it('reconnects a dead player into their dead state with no prompt', () => {
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    const villager = addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('DAY');
    game.handlePlayerDeath(villager);

    const newSocket = connect('a-new-sid');
    newSocket.fire('player:rejoin', villager.sessionToken);

    expect(newSocket.socket.emit).toHaveBeenCalledWith(
      'game:snapshot',
      expect.objectContaining({
        phase: 'DAY',
        self: expect.objectContaining({ isAlive: false }),
      })
    );
    const snapshot = (
      newSocket.socket.emit as unknown as ReturnType<typeof vi.fn>
    ).mock.calls.find((call) => call[0] === 'game:snapshot')?.[1] as
      | { pendingPrompt?: unknown }
      | undefined;
    expect(snapshot?.pendingPrompt).toBeUndefined();
  });

  it('sends the final result to a player reconnecting after the game finished', () => {
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    const villager = addPlayer('A', 'a-sid', 'VILLAGER');
    game.alertWinnersAndLosers('villagers');
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted =
      true;
    (segmentsManager as unknown as { gameFinished: boolean }).gameFinished =
      true;

    const newSocket = connect('a-new-sid');
    newSocket.fire('player:rejoin', villager.sessionToken);

    expect(newSocket.socket.emit).toHaveBeenCalledWith(
      'game:snapshot',
      expect.objectContaining({
        phase: 'FINISHED',
        didWin: true,
        gameResult: expect.objectContaining({ winningFaction: 'villagers' }),
      })
    );
  });

  it('rejects an unknown session token with player:rejoin-failed', () => {
    const socket = connect('stranger-sid');

    socket.fire('player:rejoin', 'not-a-real-token');

    expect(socket.socket.emit).toHaveBeenCalledWith('player:rejoin-failed');
  });

  it('lets a reconnected lover acknowledge from their new socket', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    const lover1 = addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    setSegment('CUPID');
    const cupidSocket = connect('cupid-sid');
    connect('p2-sid');
    const lover2Socket = connect('p3-sid');
    const finish = vi
      .spyOn(segmentsManager, 'finishSegment')
      .mockResolvedValue(undefined);

    cupidSocket.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);
    finish.mockClear();
    setSegment('LOVERS');

    const newLover1Socket = connect('p2-new-sid');
    newLover1Socket.fire('player:rejoin', lover1.sessionToken);

    newLover1Socket.fire('alert:lover-closed-alert');
    expect(finish).not.toHaveBeenCalled();
    lover2Socket.fire('alert:lover-closed-alert');
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it('safely rejects a werewolf vote from a socket that has not rejoined yet', () => {
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('WEREWOLF');

    // A client that emitted while offline flushes the event from its NEW
    // socket before player:rejoin lands: unknown sender, valid target
    const unknown = connect('fresh-unknown-sid');
    expect(() => unknown.fire('werewolf:player-voted', 'a-sid')).not.toThrow();

    expect(unknown.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Werewolf vote is not allowed now'
    );
    expect(game.getWerewolfVoteOf('fresh-unknown-sid')).toBeUndefined();
  });

  it('safely rejects a stale werewolf vote update instead of throwing', () => {
    addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    const wolfSocket = connect('wolf-sid');

    wolfSocket.fire('werewolf:player-voted', 'a-sid');
    expect(() =>
      wolfSocket.fire('werewolf:player-update-vote', 'b-sid', 'wrong-old-vote')
    ).not.toThrow();

    expect(wolfSocket.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Vote is out of date'
    );
    expect(game.getWerewolfVoteOf('wolf-sid')).toBe('a-sid');
  });

  it('re-sends the current werewolf tallies to a wolf that reconnects mid-vote', () => {
    const wolf = addPlayer('Wolf', 'wolf-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('A', 'a-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    const wolf2Socket = connect('wolf2-sid');
    wolf2Socket.fire('werewolf:player-voted', 'a-sid');

    const broadcast = vi.spyOn(
      segmentsManager.getGameActions(),
      'broadcastWerewolfVotes'
    );
    const newSocket = connect('wolf-new-sid');
    newSocket.fire('player:rejoin', wolf.sessionToken);

    expect(broadcast).toHaveBeenCalled();
  });

  it('lets a disconnected player reclaim their seat by re-entering their name', () => {
    const wolf = addPlayer('Alice', 'alice-sid', 'WEREWOLF');
    addPlayer('Wolf2', 'wolf2-sid', 'WEREWOLF');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    const oldSocket = connect('alice-sid');
    oldSocket.fire('disconnect');
    expect(wolf.isConnected).toBe(false);

    // Token is gone (app reloaded / different phone): they just type their
    // name again — matching is whitespace- and case-insensitive
    const newSocket = connect('alice-new-sid');
    newSocket.fire('player:join', '  ALICE ');

    expect(newSocket.socket.emit).not.toHaveBeenCalledWith(
      'lobby:join-rejected',
      expect.anything()
    );
    expect(newSocket.socket.emit).toHaveBeenCalledWith(
      'game:snapshot',
      expect.objectContaining({
        phase: 'WEREWOLF',
        pendingPrompt: { kind: 'WEREWOLF' },
        self: expect.objectContaining({
          name: 'Alice',
          socketId: 'alice-new-sid',
          sessionToken: wolf.sessionToken,
        }),
      })
    );
    expect(wolf.getSocketId()).toBe('alice-new-sid');
    expect(wolf.isConnected).toBe(true);
    expect(wolf.isAlive).toBe(true);
  });

  it('does not let a name join steal a connected player\'s seat', () => {
    const wolf = addPlayer('Alice', 'alice-sid', 'WEREWOLF');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');
    connect('alice-sid');

    const intruder = connect('intruder-sid');
    intruder.fire('player:join', 'Alice');

    expect(intruder.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Game already started'
    );
    expect(wolf.getSocketId()).toBe('alice-sid');
  });

  it('rejects an unknown name while a game is running', () => {
    addPlayer('Alice', 'alice-sid', 'WEREWOLF');
    addPlayer('B', 'b-sid', 'VILLAGER');
    setSegment('WEREWOLF');

    const stranger = connect('stranger-sid');
    stranger.fire('player:join', 'Nobody');

    expect(stranger.socket.emit).toHaveBeenCalledWith(
      'lobby:join-rejected',
      'Game already started'
    );
    expect(game.getPlayerList().size).toBe(2);
  });

  it('removes a player who disconnects in the lobby instead of killing them', () => {
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted =
      false;
    const socket = connect('a-sid');
    socket.fire('player:join', 'Alice');
    expect(game.getPlayerList().size).toBe(1);

    socket.fire('disconnect');

    expect(game.getPlayerList().size).toBe(0);
  });
});
