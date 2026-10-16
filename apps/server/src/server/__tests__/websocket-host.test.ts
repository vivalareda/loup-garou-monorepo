import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connection } from '@/server/connection';
import {
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_MAX_FRAME_BYTES,
  type HostTimers,
  WebSocketHost,
  type WebSocketLike,
} from '@/server/websocket-host';

const OPEN = 1;
const CLOSED = 3;
const UUID = /^[0-9a-f-]{36}$/;

function silence() {
  // Expected warnings: keep the test output readable
}

type FakeListener = (event: { data: unknown }) => void;

/** Just enough of a WebSocket for the host, driven by the test. */
class FakeSocket implements WebSocketLike {
  readyState = OPEN;
  readonly sent: string[] = [];
  closeCalls = 0;
  closeCode: number | undefined;
  failSends = false;
  private readonly listeners = new Map<string, FakeListener[]>();

  send(data: string) {
    if (this.failSends) {
      throw new Error('socket is gone');
    }
    this.sent.push(data);
  }

  close(code?: number) {
    this.closeCalls += 1;
    this.closeCode = code;
    this.readyState = CLOSED;
  }

  addEventListener(type: string, listener: FakeListener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  /** The client sends a raw frame. */
  receive(data: unknown) {
    this.fire('message', data);
  }

  /** The client sends a JSON frame. */
  receiveFrame(frame: unknown) {
    this.receive(JSON.stringify(frame));
  }

  fire(type: 'message' | 'close' | 'error', data?: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data });
    }
  }

  frames() {
    return this.sent.map((frame) => JSON.parse(frame) as unknown);
  }
}

function connect(host: WebSocketHost) {
  const socket = new FakeSocket();
  const connection = host.accept(socket);
  return { socket, connection };
}

describe('WebSocketHost', () => {
  let host: WebSocketHost;
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    host = new WebSocketHost();
    warn = vi.spyOn(console, 'warn').mockImplementation(silence);
    error = vi.spyOn(console, 'error').mockImplementation(silence);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('connections', () => {
    it('announces every accepted socket to every connection listener', () => {
      const first: Connection[] = [];
      const second: Connection[] = [];
      host.on('connection', (accepted) => first.push(accepted));
      host.on('connection', (accepted) => second.push(accepted));

      const { connection } = connect(host);

      expect(first).toEqual([connection]);
      expect(second).toEqual([connection]);
      expect(host.size).toBe(1);
    });

    it('gives each connection a fresh, stable id', () => {
      const ids = Array.from({ length: 50 }, () => connect(host).connection.id);

      expect(new Set(ids).size).toBe(50);
      expect(ids[0]).toMatch(UUID);
    });

    it('uses the injected id factory', () => {
      let next = 0;
      host = new WebSocketHost({
        createId: () => {
          next += 1;
          return `c${next}`;
        },
      });

      expect(connect(host).connection.id).toBe('c1');
      expect(connect(host).connection.id).toBe('c2');
    });

    it('keeps announcing after a connection listener throws', () => {
      const seen: string[] = [];
      host.on('connection', () => {
        throw new Error('boom');
      });
      host.on('connection', (accepted) => seen.push(accepted.id));

      const { connection } = connect(host);

      expect(seen).toEqual([connection.id]);
      expect(error).toHaveBeenCalled();
    });
  });

  describe('client events', () => {
    it('dispatches a frame to every listener of its event, in order', () => {
      const { socket, connection } = connect(host);
      const calls: string[] = [];
      connection.on('player:join', (name) => calls.push(`a:${name}`));
      connection.on('player:join', (name) => calls.push(`b:${name}`));

      socket.receiveFrame({ event: 'player:join', args: ['Alice'] });

      expect(calls).toEqual(['a:Alice', 'b:Alice']);
    });

    it('passes every argument through', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('werewolf:player-update-vote', listener);

      socket.receiveFrame({
        event: 'werewolf:player-update-vote',
        args: ['target', 'old'],
      });

      expect(listener).toHaveBeenCalledExactlyOnceWith('target', 'old');
    });

    it('keeps dispatching after a listener throws', () => {
      const { socket, connection } = connect(host);
      const after = vi.fn();
      connection.on('game:restart', () => {
        throw new Error('boom');
      });
      connection.on('game:restart', after);

      socket.receiveFrame({ event: 'game:restart', args: [] });

      expect(after).toHaveBeenCalledOnce();
      expect(error).toHaveBeenCalled();
    });

    it.each([
      ['non-JSON text', 'not json'],
      ['a JSON array', '[1,2]'],
      ['JSON null', 'null'],
      ['no event', JSON.stringify({ args: [] })],
      ['a non-string event', JSON.stringify({ event: 3, args: [] })],
      ['no args', JSON.stringify({ event: 'game:restart' })],
      ['non-array args', JSON.stringify({ event: 'game:restart', args: {} })],
      [
        'a negative ack',
        JSON.stringify({ event: 'game:restart', args: [], ack: -1 }),
      ],
      [
        'a fractional ack',
        JSON.stringify({ event: 'game:restart', args: [], ack: 1.5 }),
      ],
      [
        'a string ack',
        JSON.stringify({ event: 'game:restart', args: [], ack: '1' }),
      ],
      ['binary data', new Uint8Array([123, 125])],
    ])('ignores a frame with %s', (_label, data) => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('game:restart', listener);

      socket.receive(data);

      expect(listener).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalled();
      expect(socket.sent).toEqual([]);
    });

    it('ignores unknown events', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('game:restart', listener);

      socket.receiveFrame({ event: 'game:explode', args: [] });

      expect(listener).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('game:explode')
      );
    });

    it('never lets a client fake its own disconnect', () => {
      const { socket, connection } = connect(host);
      const onDisconnect = vi.fn();
      connection.on('disconnect', onDisconnect);

      socket.receiveFrame({ event: 'disconnect', args: [] });

      expect(onDisconnect).not.toHaveBeenCalled();
      expect(host.size).toBe(1);
    });
  });

  describe('acks', () => {
    it('hands the handler a callback that replies to the sender', () => {
      const { socket, connection } = connect(host);
      const other = connect(host);
      connection.on('agent:get-state', (reply) => {
        reply({
          phase: 'LOBBY',
          players: [],
          self: { type: 'waiting', name: '', socketId: connection.id },
        });
      });

      socket.receiveFrame({ event: 'agent:get-state', args: [], ack: 7 });

      expect(socket.frames()).toEqual([
        {
          ack: 7,
          args: [
            {
              phase: 'LOBBY',
              players: [],
              self: { type: 'waiting', name: '', socketId: connection.id },
            },
          ],
        },
      ]);
      expect(other.socket.sent).toEqual([]);
    });

    it('appends the callback after the client arguments', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('player:join', listener);

      socket.receiveFrame({ event: 'player:join', args: ['Bob'], ack: 0 });

      expect(listener).toHaveBeenCalledWith('Bob', expect.any(Function));
    });

    it('replies at most once', () => {
      const { socket, connection } = connect(host);
      connection.on('agent:get-state', (reply) => {
        const snapshot = {
          phase: 'LOBBY' as const,
          players: [],
          self: { type: 'waiting' as const, name: '', socketId: '' },
        };
        reply(snapshot);
        reply(snapshot);
      });

      socket.receiveFrame({ event: 'agent:get-state', args: [], ack: 1 });

      expect(socket.sent).toHaveLength(1);
    });

    it('passes no callback when the client asked for no reply', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('player:join', listener);

      socket.receiveFrame({ event: 'player:join', args: ['Bob'] });

      expect(listener).toHaveBeenCalledExactlyOnceWith('Bob');
    });
  });

  describe('emits', () => {
    it('sends to one connection', () => {
      const { socket, connection } = connect(host);
      const other = connect(host);

      connection.emit('lobby:players-list', [], 6);

      expect(socket.frames()).toEqual([
        { event: 'lobby:players-list', args: [[], 6] },
      ]);
      expect(other.socket.sent).toEqual([]);
    });

    it('targets a connection by id, and ignores unknown ids', () => {
      const target = connect(host);
      const other = connect(host);

      host.to(target.connection.id).emit('player:role-assigned', 'WITCH');
      host.to('nobody').emit('player:role-assigned', 'SEER');

      expect(target.socket.frames()).toEqual([
        { event: 'player:role-assigned', args: ['WITCH'] },
      ]);
      expect(other.socket.sent).toEqual([]);
    });

    it('broadcasts to everyone', () => {
      const sockets = [connect(host), connect(host)].map((c) => c.socket);

      host.emit('game:restarted');

      for (const socket of sockets) {
        expect(socket.frames()).toEqual([
          { event: 'game:restarted', args: [] },
        ]);
      }
    });

    it('broadcasts from a connection to everyone but the sender', () => {
      const sender = connect(host);
      const others = [connect(host), connect(host)];

      sender.connection.broadcast.emit('lobby:player-left', 'Alice');

      expect(sender.socket.sent).toEqual([]);
      for (const { socket } of others) {
        expect(socket.frames()).toEqual([
          { event: 'lobby:player-left', args: ['Alice'] },
        ]);
      }
    });

    it('drops emits to a socket that is no longer open', () => {
      const closing = connect(host);
      const open = connect(host);
      closing.socket.readyState = 2;

      closing.connection.emit('game:restarted');
      host.emit('game:restarted');

      expect(closing.socket.sent).toEqual([]);
      expect(open.socket.sent).toHaveLength(1);
    });

    it('survives a socket whose send throws', () => {
      const broken = connect(host);
      const healthy = connect(host);
      broken.socket.failSends = true;

      expect(() => host.emit('game:restarted')).not.toThrow();
      expect(healthy.socket.sent).toHaveLength(1);
      expect(warn).toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it.each([
      ['close', ['close']],
      ['error', ['error']],
      ['error then close', ['error', 'close']],
      ['close twice', ['close', 'close']],
    ] as const)('fires exactly once on %s', (_label, events) => {
      const { socket, connection } = connect(host);
      const first = vi.fn();
      const second = vi.fn();
      connection.on('disconnect', first);
      connection.on('disconnect', second);

      for (const event of events) {
        socket.fire(event);
      }

      expect(first).toHaveBeenCalledOnce();
      expect(second).toHaveBeenCalledOnce();
      expect(host.size).toBe(0);
    });

    it('closes the socket when it errors', () => {
      const { socket } = connect(host);

      socket.fire('error');

      expect(socket.closeCalls).toBe(1);
    });

    it('dispatches nothing after the disconnect', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('game:restart', listener);

      socket.fire('close');
      socket.receiveFrame({ event: 'game:restart', args: [] });

      expect(listener).not.toHaveBeenCalled();
    });

    it('stops sending to a disconnected connection', () => {
      const gone = connect(host);
      const stays = connect(host);
      gone.socket.fire('close');
      // Even a socket that still claims to be open
      gone.socket.readyState = OPEN;

      host.emit('game:restarted');
      host.to(gone.connection.id).emit('game:restarted');
      gone.connection.emit('game:restarted');
      stays.connection.broadcast.emit('game:restarted');

      expect(gone.socket.sent).toEqual([]);
      expect(stays.socket.sent).toHaveLength(1);
    });

    it('lets disconnect listeners broadcast to the remaining clients', () => {
      const leaving = connect(host);
      const staying = connect(host);
      leaving.connection.on('disconnect', () =>
        host.emit('lobby:player-left', 'Alice')
      );

      leaving.socket.fire('close');

      expect(staying.socket.frames()).toEqual([
        { event: 'lobby:player-left', args: ['Alice'] },
      ]);
    });

    it('keeps notifying after a disconnect listener throws', () => {
      const { socket, connection } = connect(host);
      const after = vi.fn();
      connection.on('disconnect', () => {
        throw new Error('boom');
      });
      connection.on('disconnect', after);

      socket.fire('close');

      expect(after).toHaveBeenCalledOnce();
    });
  });

  describe('heartbeat', () => {
    it('answers a ping with a pong, dispatching nothing', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('game:restart', listener);

      socket.receiveFrame({ ping: 7 });

      expect(socket.frames()).toEqual([{ pong: 7 }]);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('idle timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      host = new WebSocketHost();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('drops a silent connection whose socket never closes', () => {
      const { socket, connection } = connect(host);
      const onDisconnect = vi.fn();
      connection.on('disconnect', onDisconnect);

      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS - 1);
      expect(onDisconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(socket.closeCode).toBe(4000);
      expect(host.size).toBe(0);
      // Its eventual `close` is the same disconnect
      socket.fire('close');
      expect(onDisconnect).toHaveBeenCalledOnce();
    });

    it('restarts the countdown on every inbound frame, pings included', () => {
      const { socket, connection } = connect(host);
      const onDisconnect = vi.fn();
      connection.on('disconnect', onDisconnect);

      vi.advanceTimersByTime(40_000);
      socket.receiveFrame({ ping: 1 });
      vi.advanceTimersByTime(40_000);
      socket.receive('garbage');
      vi.advanceTimersByTime(40_000);
      expect(onDisconnect).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5000);

      expect(onDisconnect).toHaveBeenCalledOnce();
    });

    it('cancels its timer when the connection closes', () => {
      const { socket } = connect(host);

      socket.fire('close');

      expect(vi.getTimerCount()).toBe(0);
    });

    it('can be turned off', () => {
      host = new WebSocketHost({ idleTimeoutMs: 0 });
      connect(host);

      vi.advanceTimersByTime(10 * DEFAULT_IDLE_TIMEOUT_MS);

      expect(host.size).toBe(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it('runs on injected timers', () => {
      const pending = new Map<number, () => void>();
      let nextHandle = 0;
      const timers: HostTimers = {
        setTimeout: (callback) => {
          nextHandle += 1;
          pending.set(nextHandle, callback);
          return nextHandle;
        },
        clearTimeout: (handle) => pending.delete(handle as number),
      };
      host = new WebSocketHost({ idleTimeoutMs: 1000, timers });
      const { connection } = connect(host);
      const onDisconnect = vi.fn();
      connection.on('disconnect', onDisconnect);

      for (const callback of [...pending.values()]) {
        callback();
      }

      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(pending.size).toBe(0);
    });
  });

  describe('frame size limit', () => {
    const frameOfSize = (bytes: number, char = 'a') => {
      const empty = JSON.stringify({ event: 'player:join', args: [''] });
      const padding = Math.floor((bytes - empty.length) / char.length);
      return JSON.stringify({
        event: 'player:join',
        args: [char.repeat(padding)],
      });
    };

    it('accepts a frame at the limit', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('player:join', listener);
      const frame = frameOfSize(DEFAULT_MAX_FRAME_BYTES);
      expect(frame.length).toBe(DEFAULT_MAX_FRAME_BYTES);

      socket.receive(frame);

      expect(listener).toHaveBeenCalledOnce();
    });

    it('closes the connection on a larger frame, before parsing it', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      const onDisconnect = vi.fn();
      connection.on('player:join', listener);
      connection.on('disconnect', onDisconnect);

      socket.receive(frameOfSize(DEFAULT_MAX_FRAME_BYTES + 1));

      expect(listener).not.toHaveBeenCalled();
      expect(onDisconnect).toHaveBeenCalledOnce();
      expect(socket.closeCode).toBe(1009);
    });

    it('counts UTF-8 bytes, not characters', () => {
      const { socket, connection } = connect(host);
      const listener = vi.fn();
      connection.on('player:join', listener);
      // 3 bytes per character: under the limit in length, over it in bytes
      const frame = frameOfSize(DEFAULT_MAX_FRAME_BYTES / 2, '€');
      expect(frame.length).toBeLessThan(DEFAULT_MAX_FRAME_BYTES);

      socket.receive(frame);

      expect(listener).not.toHaveBeenCalled();
      expect(socket.closeCode).toBe(1009);
    });

    it('honors a configured limit', () => {
      host = new WebSocketHost({ maxFrameBytes: 100 });
      const { socket } = connect(host);

      socket.receive(frameOfSize(101));

      expect(socket.closeCode).toBe(1009);
      expect(host.size).toBe(0);
    });
  });
});
