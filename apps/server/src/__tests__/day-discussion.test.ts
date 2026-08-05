import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import type { Socket } from 'socket.io';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('day discussion and countdowns', () => {
  let mockIo: SocketType;
  let ioEmit: ReturnType<typeof vi.fn>;
  let game: Game;
  let segmentsManager: SegmentsManager;
  let connectionHandler:
    | ((socket: Socket<ClientToServerEvents, ServerToClientEvents>) => void)
    | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('DAY_DISCUSSION_MS', '5000');

    ioEmit = vi.fn();
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

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
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
    return player;
  };

  const setSegment = (type: string) => {
    (segmentsManager as unknown as { gameStarted: boolean }).gameStarted = true;
    segmentsManager.currentSegment = segmentsManager.segments.findIndex(
      (segment) => segment.type === type
    );
  };

  const emittedEvents = () => ioEmit.mock.calls.map((call) => call[0]);

  it('opens a discussion window before the vote and starts the vote when it expires', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    setSegment('DAY');

    await segmentsManager.getGameActions().dayAction();

    expect(ioEmit).toHaveBeenCalledWith('game:countdown', 'DAY-DISCUSSION', 5000);
    expect(emittedEvents()).not.toContain('day:voting-phase-start');
    expect(segmentsManager.getGameActions().isDayVotingOpen()).toBe(false);

    vi.advanceTimersByTime(5000);

    expect(emittedEvents()).toContain('day:voting-phase-start');
    expect(segmentsManager.getGameActions().isDayVotingOpen()).toBe(true);
  });

  it('rejects day votes during the discussion window', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    setSegment('DAY');
    await segmentsManager.getGameActions().dayAction();

    const voter = connect('a-sid');
    const spy = vi.spyOn(game, 'handleDayVote');
    voter.fire('day:player-voted', 'w-sid');

    expect(spy).not.toHaveBeenCalled();
    expect(voter.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Day vote is not allowed now'
    );
  });

  it('lets any living player end the discussion early, exactly once', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    setSegment('DAY');
    await segmentsManager.getGameActions().dayAction();

    const villager = connect('a-sid');
    villager.fire('day:start-vote');

    expect(emittedEvents()).toContain('day:voting-phase-start');
    expect(segmentsManager.getGameActions().isDayVotingOpen()).toBe(true);

    const again = connect('b-sid');
    again.fire('day:start-vote');
    expect(again.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Cannot start the vote now'
    );
    expect(
      emittedEvents().filter((event) => event === 'day:voting-phase-start')
    ).toHaveLength(1);
  });

  it('rejects day:start-vote from dead players and outside the discussion', async () => {
    const dead = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    dead.setIsAlive(false);
    setSegment('DAY');
    await segmentsManager.getGameActions().dayAction();

    const deadSocket = connect('a-sid');
    deadSocket.fire('day:start-vote');
    expect(deadSocket.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Cannot start the vote now'
    );

    setSegment('WEREWOLF');
    const living = connect('b-sid');
    living.fire('day:start-vote');
    expect(living.socket.emit).toHaveBeenCalledWith(
      'alert:action-error',
      'Cannot start the vote now'
    );
  });

  it('marks the game FINISHED when dawn deaths decide the winner, so game:restart works', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    setSegment('DAY');
    game.addPendingDeath('a-sid', 'WITCH_POISON');

    await segmentsManager.getGameActions().dayAction();

    expect(segmentsManager.hasFinished()).toBe(true);
    expect(segmentsManager.getCurrentSegmentType()).toBe('FINISHED');
    expect(emittedEvents()).not.toContain('game:countdown');

    const wolf = connect('w-sid');
    wolf.fire('game:restart');
    expect(emittedEvents()).toContain('game:restarted');
  });

  it('emits a countdown when a segment deadline is scheduled and a timeout event when it fires', async () => {
    vi.stubEnv('SEER_TIMEOUT_MS', '3000');
    addPlayer('A', 'a-sid', 'VILLAGER');
    const seer = addPlayer('Seer', 'seer-sid', 'SEER');
    game.setSpecialRolePlayer(seer);
    setSegment('SEER');

    await segmentsManager.playSegment();

    expect(ioEmit).toHaveBeenCalledWith('game:countdown', 'SEER', 3000);

    await vi.advanceTimersByTimeAsync(3000);

    expect(ioEmit).toHaveBeenCalledWith('game:phase-timed-out', 'SEER');
    expect(segmentsManager.getCurrentSegmentType()).not.toBe('SEER');
  });

  it('includes the running countdown in reconnect snapshots', async () => {
    addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('W', 'w-sid', 'WEREWOLF');
    setSegment('DAY');
    await segmentsManager.getGameActions().dayAction();

    const gameEvents = new GameEvents(
      game,
      segmentsManager,
      mockIo,
      new EventsActions(game, segmentsManager, mockIo)
    );
    const player = game.getPlayerBySocketId('a-sid');
    if (!player) {
      throw new Error('player not found');
    }

    vi.advanceTimersByTime(2000);
    const snapshot = gameEvents.buildSnapshotFor(player);
    expect(snapshot.countdown).toEqual({
      phase: 'DAY-DISCUSSION',
      remainingMs: 3000,
    });

    vi.advanceTimersByTime(3000);
    const votingSnapshot = gameEvents.buildSnapshotFor(player);
    expect(votingSnapshot.pendingPrompt).toEqual({ kind: 'DAY-VOTE' });
  });
});
