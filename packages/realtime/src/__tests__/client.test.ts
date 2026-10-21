import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type ClientWebSocket,
  createRealtimeClient,
  type RealtimeClientOptions,
} from '../client';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

type FakeListener = (event: { data: unknown; code: number }) => void;

/** A WebSocket the test opens, feeds and drops by hand. */
class FakeWebSocket implements ClientWebSocket {
  static instances: FakeWebSocket[] = [];
  static failNext = false;

  readonly url: string;
  readyState = CONNECTING;
  readonly sent: string[] = [];
  closedWith: number | undefined;
  private readonly listeners = new Map<string, FakeListener[]>();

  constructor(url: string) {
    if (FakeWebSocket.failNext) {
      FakeWebSocket.failNext = false;
      throw new Error('bad url');
    }

    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  static latest() {
    const [socket] = FakeWebSocket.instances.slice(-1);

    if (!socket) {
      throw new Error('no socket was opened');
    }

    return socket;
  }

  send(data: string) {
    if (this.readyState !== OPEN) {
      throw new Error('not open');
    }

    this.sent.push(data);
  }

  close(code?: number) {
    this.closedWith = code;
    this.readyState = CLOSED;
  }

  addEventListener(type: string, listener: FakeListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  open() {
    this.readyState = OPEN;
    this.fire('open');
  }

  /** The network drops: browsers report `error`, then `close`. */
  drop(code = 1006) {
    this.readyState = CLOSED;
    this.fire('error');
    this.fire('close', undefined, code);
  }

  serverSends(frame: unknown) {
    this.fire('message', JSON.stringify(frame));
  }

  serverSendsRaw(data: unknown) {
    this.fire('message', data);
  }

  frames() {
    return this.sent.map((frame) => JSON.parse(frame) as unknown);
  }

  private fire(type: string, data?: unknown, code = 1000) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data, code });
    }
  }
}

const ROOM_URL = 'ws://game.test/room/default';

function silence() {
  // Expected warnings: keep the test output readable
}

function makeClient(options: RealtimeClientOptions = {}) {
  return createRealtimeClient(ROOM_URL, {
    WebSocket: FakeWebSocket,
    randomizationFactor: 0,
    ...options,
  });
}

const snapshot = {
  phase: 'LOBBY' as const,
  players: [],
  self: { type: 'waiting' as const, name: '', socketId: 'abc' },
};

describe('RealtimeClient', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    FakeWebSocket.failNext = false;
    vi.spyOn(console, 'warn').mockImplementation(silence);
    vi.spyOn(console, 'error').mockImplementation(silence);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('connecting', () => {
    it('opens the socket right away by default', () => {
      const client = makeClient();

      expect(FakeWebSocket.instances).toHaveLength(1);
      expect(FakeWebSocket.latest().url).toBe(ROOM_URL);
      expect(client.connected).toBe(false);
    });

    it('waits for connect() when autoConnect is off', () => {
      const client = makeClient({ autoConnect: false });
      expect(FakeWebSocket.instances).toHaveLength(0);

      client.connect();

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('fires connect once the socket opens', () => {
      const client = makeClient();
      const onConnect = vi.fn();
      client.on('connect', onConnect);

      FakeWebSocket.latest().open();

      expect(onConnect).toHaveBeenCalledOnce();
      expect(client.connected).toBe(true);
    });

    it('does not open a second socket when already connecting', () => {
      const client = makeClient();

      client.connect();

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('uses the global WebSocket when none is injected', () => {
      vi.stubGlobal('WebSocket', FakeWebSocket);

      try {
        createRealtimeClient(ROOM_URL);
        expect(FakeWebSocket.instances).toHaveLength(1);
      } finally {
        vi.unstubAllGlobals();
      }
    });
  });

  describe('emitting', () => {
    it('sends an event frame while connected', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();

      client.emit('werewolf:player-update-vote', 'target', 'old');

      expect(socket.frames()).toEqual([
        { event: 'werewolf:player-update-vote', args: ['target', 'old'] },
      ]);
    });

    it('drops every emit made before the first connection by default', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();

      expect(client.emit('admin:next-segment')).toBe(false);
      expect(client.emit('player:join', 'Ana')).toBe(false);
      socket.open();

      expect(socket.sent).toEqual([]);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('admin:next-segment')
      );
    });

    it('queues allowlisted emits until connected, then flushes them in order before connect fires', () => {
      const client = makeClient({
        bufferBeforeConnect: ['player:join', 'lobby:get-players-list'],
      });

      const socket = FakeWebSocket.latest();
      let sentWhenConnectFired: unknown[] = [];
      client.on('connect', () => {
        sentWhenConnectFired = socket.frames();
      });

      expect(client.emit('lobby:get-players-list')).toBe(true);
      expect(client.emit('werewolf:player-voted', 'v1')).toBe(false);
      expect(client.emit('player:join', 'Ana')).toBe(true);
      expect(client.emit('admin:next-segment')).toBe(false);
      expect(socket.sent).toEqual([]);
      socket.open();

      expect(sentWhenConnectFired).toEqual([
        { event: 'lobby:get-players-list', args: [] },
        { event: 'player:join', args: ['Ana'] },
      ]);
    });

    it('sends any event once connected', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();

      expect(client.emit('admin:next-segment')).toBe(true);
      expect(FakeWebSocket.latest().frames()).toEqual([
        { event: 'admin:next-segment', args: [] },
      ]);
    });

    it('drops emits made while reconnecting, even allowlisted ones', () => {
      const client = makeClient({
        bufferBeforeConnect: ['admin:next-segment'],
      });

      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();

      expect(client.emit('admin:next-segment')).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('admin:next-segment')
      );
      vi.advanceTimersByTime(1000);
      const next = FakeWebSocket.latest();
      next.open();

      expect(next.sent).toEqual([]);
    });

    it('lets connect listeners re-send after a reconnect', () => {
      const client = makeClient();
      client.on('connect', () => client.emit('narrator:register'));
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(1000);
      const next = FakeWebSocket.latest();

      next.open();

      expect(next.frames()).toEqual([{ event: 'narrator:register', args: [] }]);
    });

    it('never calls the ack of a dropped emit', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();
      const callback = vi.fn();

      expect(client.emit('agent:get-state', callback)).toBe(false);
      vi.advanceTimersByTime(1000);
      const next = FakeWebSocket.latest();
      next.open();
      next.serverSends({ ack: 0, args: [snapshot] });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('heartbeat', () => {
    it('pings while connected and keeps the connection while pongs come back', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();

      vi.advanceTimersByTime(19_999);
      expect(socket.sent).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(socket.frames()).toEqual([{ ping: 1 }]);
      socket.serverSends({ pong: 1 });
      vi.advanceTimersByTime(20_000);
      socket.serverSends({ pong: 2 });
      vi.advanceTimersByTime(15_000);

      expect(socket.frames()).toEqual([{ ping: 1 }, { ping: 2 }]);
      expect(client.connected).toBe(true);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('gives up on a silent socket that never closes, then reconnects', () => {
      const client = makeClient();
      const events: string[] = [];
      client.on('connect', () => events.push('connect'));
      client.on('disconnect', (reason) => events.push(`disconnect:${reason}`));
      const silent = FakeWebSocket.latest();
      silent.open();

      // The ping goes out, the pong never comes, and `close` never fires
      vi.advanceTimersByTime(20_000);
      vi.advanceTimersByTime(9999);
      expect(client.connected).toBe(true);
      vi.advanceTimersByTime(1);

      expect(client.connected).toBe(false);
      expect(silent.closedWith).toBe(4000);
      vi.advanceTimersByTime(1000);
      const next = FakeWebSocket.latest();
      expect(next).not.toBe(silent);
      next.open();
      // A late pong from the abandoned socket changes nothing
      silent.serverSends({ pong: 1 });
      expect(events).toEqual([
        'connect',
        'disconnect:transport close',
        'connect',
      ]);
    });

    it('ignores a pong for an older ping', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      vi.advanceTimersByTime(20_000);

      FakeWebSocket.latest().serverSends({ pong: 0 });
      vi.advanceTimersByTime(10_000);

      expect(client.connected).toBe(false);
    });

    it('can be turned off', () => {
      const client = makeClient({ pingIntervalMs: 0 });
      FakeWebSocket.latest().open();

      vi.advanceTimersByTime(120_000);

      expect(FakeWebSocket.latest().sent).toEqual([]);
      expect(client.connected).toBe(true);
    });
  });

  describe('handshake timeout', () => {
    it('aborts a stalled handshake and retries', () => {
      const client = makeClient();
      const onError = vi.fn();
      client.on('connect_error', onError);
      const stalled = FakeWebSocket.latest();

      vi.advanceTimersByTime(9999);
      expect(onError).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(onError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'WebSocket handshake timed out' })
      );
      expect(stalled.closedWith).toBe(4000);
      vi.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(2);
      // The stalled socket opening late is ignored
      stalled.open();
      expect(client.connected).toBe(false);
    });

    it('is cleared once the socket opens', () => {
      const client = makeClient({ pingIntervalMs: 0 });
      FakeWebSocket.latest().open();

      vi.advanceTimersByTime(60_000);

      expect(client.connected).toBe(true);
    });
  });

  describe('acks', () => {
    it('sends an ack id and calls the callback with the reply', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const callback = vi.fn();

      client.emit('agent:get-state', callback);
      expect(socket.frames()).toEqual([
        { event: 'agent:get-state', args: [], ack: 0 },
      ]);
      socket.serverSends({ ack: 0, args: [snapshot] });

      expect(callback).toHaveBeenCalledExactlyOnceWith(snapshot);
    });

    it('matches replies by id and calls each callback once', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const first = vi.fn();
      const second = vi.fn();

      client.emit('agent:get-state', first);
      client.emit('agent:get-state', second);
      socket.serverSends({ ack: 1, args: ['two'] });
      socket.serverSends({ ack: 0, args: ['one'] });
      socket.serverSends({ ack: 0, args: ['again'] });
      socket.serverSends({ ack: 99, args: ['unknown'] });

      expect(first).toHaveBeenCalledExactlyOnceWith('one');
      expect(second).toHaveBeenCalledExactlyOnceWith('two');
    });

    it('keeps the ack of a queued emit until it is answered', () => {
      const client = makeClient({ bufferBeforeConnect: ['agent:get-state'] });
      const callback = vi.fn();
      client.emit('agent:get-state', callback);
      const socket = FakeWebSocket.latest();
      socket.open();

      socket.serverSends({ ack: 0, args: [snapshot] });

      expect(callback).toHaveBeenCalledOnce();
    });

    it('never calls an ack whose connection dropped before the reply', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      const callback = vi.fn();
      client.emit('agent:get-state', callback);

      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(1000);
      const next = FakeWebSocket.latest();
      next.open();
      next.serverSends({ ack: 0, args: [snapshot] });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('listeners', () => {
    it('dispatches server events to every listener with their arguments', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const first = vi.fn();
      const second = vi.fn();
      client.on('lobby:players-list', first);
      client.on('lobby:players-list', second);

      socket.serverSends({ event: 'lobby:players-list', args: [[], 6] });

      expect(first).toHaveBeenCalledExactlyOnceWith([], 6);
      expect(second).toHaveBeenCalledExactlyOnceWith([], 6);
    });

    it('runs a once listener a single time', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const listener = vi.fn();
      client.once('cupid:pick-required', listener);

      socket.serverSends({ event: 'cupid:pick-required', args: [] });
      socket.serverSends({ event: 'cupid:pick-required', args: [] });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('removes one listener, or all of an event', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const kept = vi.fn();
      const removed = vi.fn();
      const onceRemoved = vi.fn();
      const other = vi.fn();
      client.on('game:restarted', kept);
      client.on('game:restarted', removed);
      client.once('game:restarted', onceRemoved);
      client.on('alert:player-is-dead', other);

      client.off('game:restarted', removed);
      client.off('game:restarted', onceRemoved);
      socket.serverSends({ event: 'game:restarted', args: [] });
      client.off('game:restarted');
      socket.serverSends({ event: 'game:restarted', args: [] });
      socket.serverSends({ event: 'alert:player-is-dead', args: [] });

      expect(kept).toHaveBeenCalledOnce();
      expect(removed).not.toHaveBeenCalled();
      expect(onceRemoved).not.toHaveBeenCalled();
      expect(other).toHaveBeenCalledOnce();
    });

    it('keeps dispatching after a listener throws', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const after = vi.fn();
      client.on('game:restarted', () => {
        throw new Error('boom');
      });
      client.on('game:restarted', after);

      socket.serverSends({ event: 'game:restarted', args: [] });

      expect(after).toHaveBeenCalledOnce();
      expect(console.error).toHaveBeenCalled();
    });

    it('reports every server event to onAny listeners', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const any = vi.fn();
      client.onAny(any);

      socket.serverSends({ event: 'game:countdown', args: ['WEREWOLF', 500] });

      expect(any).toHaveBeenCalledExactlyOnceWith(
        'game:countdown',
        'WEREWOLF',
        500
      );
    });

    it.each([
      ['non-JSON text', 'nope'],
      ['binary data', new Uint8Array([1])],
      ['a frame without args', JSON.stringify({ event: 'game:restarted' })],
      ['an unknown event', JSON.stringify({ event: 'game:nope', args: [] })],
      [
        'a reserved event',
        JSON.stringify({ event: 'disconnect', args: ['transport close'] }),
      ],
    ])('ignores %s', (_label, data) => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const listener = vi.fn();
      client.on('disconnect', listener);
      client.on('game:restarted', listener);
      client.onAny(listener);

      socket.serverSendsRaw(data);

      expect(listener).not.toHaveBeenCalled();
      expect(client.connected).toBe(true);
    });
  });

  describe('reconnecting', () => {
    it('fires disconnect, then reconnects and fires connect again', () => {
      const client = makeClient();
      const events: string[] = [];
      client.on('connect', () => events.push('connect'));
      client.on('disconnect', (reason) => events.push(`disconnect:${reason}`));
      FakeWebSocket.latest().open();

      FakeWebSocket.latest().drop();
      expect(client.connected).toBe(false);
      vi.advanceTimersByTime(999);
      expect(FakeWebSocket.instances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(2);
      FakeWebSocket.latest().open();

      expect(events).toEqual([
        'connect',
        'disconnect:transport close',
        'connect',
      ]);
      expect(client.connected).toBe(true);
    });

    it('backs off exponentially up to the cap, and resets once connected', () => {
      makeClient({ reconnectDelayMs: 100, reconnectDelayMaxMs: 500 });
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();

      const delays: number[] = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const before = FakeWebSocket.instances.length;
        let waited = 0;

        while (FakeWebSocket.instances.length === before) {
          vi.advanceTimersByTime(10);
          waited += 10;
        }

        delays.push(waited);

        if (attempt < 4) {
          FakeWebSocket.latest().drop();
        }
      }

      expect(delays).toEqual([100, 200, 400, 500, 500]);

      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();
      const before = FakeWebSocket.instances.length;
      vi.advanceTimersByTime(100);
      expect(FakeWebSocket.instances).toHaveLength(before + 1);
    });

    it('jitters the delay by the randomization factor', () => {
      const random = vi.spyOn(Math, 'random');
      makeClient({ randomizationFactor: 0.5 });
      FakeWebSocket.latest().open();

      random.mockReturnValue(0);
      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(499);
      expect(FakeWebSocket.instances).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(2);

      FakeWebSocket.latest().open();
      random.mockReturnValue(0.999_999);
      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(1499);
      expect(FakeWebSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(3);
    });

    it('fires connect_error when an attempt fails before opening', () => {
      const client = makeClient();
      const onError = vi.fn();
      const onDisconnect = vi.fn();
      client.on('connect_error', onError);
      client.on('disconnect', onDisconnect);

      FakeWebSocket.latest().drop();

      expect(onError).toHaveBeenCalledExactlyOnceWith(expect.any(Error));
      expect(onDisconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });

    it('retries when the WebSocket constructor throws', () => {
      FakeWebSocket.failNext = true;
      const client = makeClient({ autoConnect: false });
      const onError = vi.fn();
      client.on('connect_error', onError);

      client.connect();

      expect(onError).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ message: 'bad url' })
      );
      vi.advanceTimersByTime(1000);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('does not reconnect when reconnect is off', () => {
      makeClient({ reconnect: false });
      FakeWebSocket.latest().open();

      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(60_000);

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('connects at once when connect() is called during the backoff', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();

      client.connect();
      expect(FakeWebSocket.instances).toHaveLength(2);
      vi.advanceTimersByTime(5000);
      expect(FakeWebSocket.instances).toHaveLength(2);
    });
  });

  describe('disconnect()', () => {
    it('closes the socket, fires disconnect and stays down', () => {
      const client = makeClient();
      const socket = FakeWebSocket.latest();
      socket.open();
      const onDisconnect = vi.fn();
      client.on('disconnect', onDisconnect);

      client.disconnect();
      // The browser reports the close later: already let go of
      socket.drop(1000);
      vi.advanceTimersByTime(60_000);

      expect(socket.closedWith).toBe(1000);
      expect(onDisconnect).toHaveBeenCalledExactlyOnceWith('client disconnect');
      expect(client.connected).toBe(false);
      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('cancels a pending reconnect', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      FakeWebSocket.latest().drop();

      client.disconnect();
      vi.advanceTimersByTime(60_000);

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('can be called from a disconnect listener to stop reconnecting', () => {
      const client = makeClient();
      FakeWebSocket.latest().open();
      client.on('disconnect', () => client.disconnect());

      FakeWebSocket.latest().drop();
      vi.advanceTimersByTime(60_000);

      expect(FakeWebSocket.instances).toHaveLength(1);
    });

    it('drops the queue and pending acks, and connect() starts over', () => {
      const client = makeClient({
        bufferBeforeConnect: ['lobby:get-players-list', 'agent:get-state'],
      });

      const callback = vi.fn();
      client.emit('lobby:get-players-list');
      client.emit('agent:get-state', callback);

      client.disconnect();
      client.connect();
      const socket = FakeWebSocket.latest();
      socket.open();
      socket.serverSends({ ack: 0, args: [snapshot] });

      expect(FakeWebSocket.instances).toHaveLength(2);
      expect(socket.sent).toEqual([]);
      expect(callback).not.toHaveBeenCalled();
      expect(client.connected).toBe(true);
    });

    it('leaves no timer behind', () => {
      const connected = makeClient();
      FakeWebSocket.latest().open();
      vi.advanceTimersByTime(20_000);
      // Pong deadline pending
      connected.disconnect();
      const connecting = makeClient();
      // Handshake timeout pending
      connecting.disconnect();
      const retrying = makeClient();
      FakeWebSocket.latest().drop();
      // Reconnect pending
      retrying.disconnect();

      expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps one timer per state while running', () => {
      const client = makeClient();
      expect(vi.getTimerCount()).toBe(1);
      FakeWebSocket.latest().open();
      expect(vi.getTimerCount()).toBe(1);
      FakeWebSocket.latest().drop();
      expect(vi.getTimerCount()).toBe(1);
      client.disconnect();
      expect(vi.getTimerCount()).toBe(0);
    });

    it('does not fire disconnect when it was never connected', () => {
      const client = makeClient();
      const onDisconnect = vi.fn();
      client.on('disconnect', onDisconnect);

      client.disconnect();

      expect(onDisconnect).not.toHaveBeenCalled();
    });
  });
});
