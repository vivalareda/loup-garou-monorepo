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

  it('cupid:lovers-pick from a non-cupid socket does not set lovers', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'setLovers');
    attacker.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).not.toHaveBeenCalled();
  });

  it('cupid:lovers-pick from the real cupid sets lovers', () => {
    addPlayer('Cupid', 'cupid-sid', 'CUPID');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    const cupid = connect('cupid-sid');

    const spy = vi.spyOn(game, 'setLovers');
    cupid.fire('cupid:lovers-pick', ['p2-sid', 'p3-sid']);

    expect(spy).toHaveBeenCalledWith(['p2-sid', 'p3-sid']);
  });

  it('witch:healed-player from a non-witch socket does not heal', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'healWerewolfVictim');
    attacker.fire('witch:healed-player');

    expect(spy).not.toHaveBeenCalled();
  });

  it('witch:poisoned-player from a non-witch socket does not poison', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
    addPlayer('P3', 'p3-sid', 'VILLAGER');
    const attacker = connect('attacker-sid');

    const spy = vi.spyOn(game, 'witchKill');
    attacker.fire('witch:poisoned-player', 'p2-sid');

    expect(spy).not.toHaveBeenCalled();
  });

  it('witch:skipped-heal from a non-witch socket does not finish the segment', () => {
    addPlayer('Witch', 'witch-sid', 'WITCH');
    addPlayer('P2', 'p2-sid', 'VILLAGER');
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

  it('day:player-voted from a dead voter is not counted', async () => {
    const a = addPlayer('A', 'a-sid', 'VILLAGER');
    addPlayer('B', 'b-sid', 'VILLAGER');
    addPlayer('C', 'c-sid', 'WEREWOLF');
    addPlayer('D', 'd-sid', 'WEREWOLF');
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

    const voter = connect('a-sid');
    const spy = vi.spyOn(game, 'handleDayVote');
    voter.fire('day:player-voted', 'b-sid');

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith('a-sid', 'b-sid');
  });
});
