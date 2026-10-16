import { exports } from 'cloudflare:workers';
import { encodeFrame } from '@repo/types';
import { afterEach, describe, expect, it } from 'vitest';

type Frame = { event?: string; args?: unknown[]; pong?: number };

const ORIGIN = 'http://game.test';
const open: Client[] = [];

/** A raw WebSocket client of one room, recording every frame it gets. */
class Client {
  readonly frames: Frame[] = [];
  private readonly waiters: (() => void)[] = [];
  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (message) => {
      this.frames.push(JSON.parse(String(message.data)) as Frame);
      for (const wake of this.waiters.splice(0)) {
        wake();
      }
    });
  }

  emit(event: string, ...args: unknown[]) {
    this.socket.send(encodeFrame({ event, args }));
  }

  ping(n: number) {
    this.socket.send(JSON.stringify({ ping: n }));
  }

  events() {
    return this.frames.flatMap((frame) => (frame.event ? [frame.event] : []));
  }

  /** The first frame matching `match`, waiting up to 2s for it. */
  async next(match: (frame: Frame) => boolean): Promise<Frame> {
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const found = this.frames.find(match);
      if (found) {
        return found;
      }
      await new Promise<void>((resolve) => {
        this.waiters.push(resolve);
        setTimeout(resolve, 50);
      });
    }
    throw new Error(`No matching frame; got ${JSON.stringify(this.frames)}`);
  }

  event(name: string) {
    return this.next((frame) => frame.event === name);
  }

  close() {
    this.socket.close(1000);
  }
}

function request(path: string, init?: RequestInit) {
  return exports.default.fetch(`${ORIGIN}${path}`, init);
}

async function connect(code: string) {
  const response = await request(`/room/${code}`, {
    headers: { Upgrade: 'websocket' },
  });
  const socket = response.webSocket;
  if (response.status !== 101 || !socket) {
    throw new Error(`Upgrade failed with ${response.status}`);
  }
  socket.accept();
  const client = new Client(socket);
  open.push(client);
  return client;
}

/** Lets in-flight frames land before asserting that nothing arrived. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

afterEach(() => {
  for (const client of open.splice(0)) {
    client.close();
  }
});

describe('routing', () => {
  it.each(['/room/bad!code', '/room/', `/room/${'x'.repeat(65)}`, '/room/a/b'])(
    'rejects the room path %s with 400',
    async (path) => {
      const response = await request(path, {
        headers: { Upgrade: 'websocket' },
      });
      expect(response.status).toBe(400);
    }
  );

  it('answers 426 to a room request that is not a WebSocket upgrade', async () => {
    const response = await request('/room/TEST');
    expect(response.status).toBe(426);
    expect(response.headers.get('Upgrade')).toBe('websocket');
  });

  it('accepts a trailing slash and answers the app-level heartbeat', async () => {
    const client = await connect('HEARTBEAT/');
    client.ping(7);
    expect(await client.next((frame) => frame.pong !== undefined)).toEqual({
      pong: 7,
    });
  });
});

describe('rooms', () => {
  it('sends lobby events to a joining client and its room', async () => {
    const alice = await connect('LOBBY');
    const bob = await connect('LOBBY');

    alice.emit('player:join', 'Alice');
    const data = await alice.event('lobby:player-data');
    expect(data.args?.[0]).toMatchObject({ name: 'Alice' });
    const update = await bob.event('lobby:update-players-list');
    expect(update.args?.[0]).toMatchObject({ name: 'Alice' });
  });

  it('isolates rooms from each other', async () => {
    const red = await connect('RED');
    const redWatcher = await connect('RED');
    const blue = await connect('BLUE');

    red.emit('player:join', 'Alice');
    await redWatcher.event('lobby:update-players-list');

    // The same name is free in another room, and nothing crosses over
    blue.emit('player:join', 'Alice');
    await blue.event('lobby:player-data');
    await settle();
    expect(blue.events()).toEqual(['lobby:player-data']);
    expect(redWatcher.events()).toEqual(['lobby:update-players-list']);
  });

  it('treats room codes case-insensitively', async () => {
    const lower = await connect('case-room');
    const upper = await connect('CASE-ROOM');

    lower.emit('player:join', 'Alice');
    await lower.event('lobby:player-data');
    upper.emit('player:join', 'alice');
    const rejected = await upper.event('lobby:join-rejected');
    expect(rejected.args).toEqual(['Name already taken']);
  });

  it('starts the game once the room is full', async () => {
    const players = await Promise.all(
      ['A', 'B', 'C', 'D'].map(() => connect('FULL'))
    );
    for (const [index, player] of players.entries()) {
      player.emit('player:join', `Player ${index + 1}`);
      await player.event('lobby:player-data');
    }
    // PLAYER_COUNT is 4 in vitest.config.ts
    for (const player of players) {
      await player.event('lobby:villagers-list');
    }
  });
});
