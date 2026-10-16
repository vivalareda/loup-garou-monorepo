import { runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { encodeFrame, roomUrl } from '@repo/types';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameRuntime } from '@/game-runtime';
import type { WebSocketHost } from '@/server/websocket-host';
import worker from '../src/index';

type Frame = { event?: string; args?: unknown[]; pong?: number };

const ORIGIN = 'http://game.test';
const WS_SCHEME = /^ws/;
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

const upgrade = { headers: { Upgrade: 'websocket' } };

async function connect(code: string, upgraded?: Response) {
  const response = upgraded ?? (await request(`/room/${code}`, upgrade));
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

type Room = { host: WebSocketHost; runtime: GameRuntime };

/** Runs `inspect` inside a room's Durable Object, on its game. */
function inRoom<R>(code: string, inspect: (room: Room) => R) {
  const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));
  return runInDurableObject(stub, (instance) => {
    const { room } = instance as unknown as { room: Room | undefined };
    if (!room) {
      throw new Error(`Room ${code} has no game`);
    }
    return inspect(room);
  });
}

/** Waits until the room has seen every client socket close. */
async function emptied(code: string) {
  for (let attempt = 0; attempt < 40; attempt++) {
    if ((await inRoom(code, (room) => room.host.size)) === 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Room ${code} still has sockets`);
}

/** Fills a room (PLAYER_COUNT is 4), which starts its game. */
async function startGame(code: string) {
  const players = await Promise.all(
    ['A', 'B', 'C', 'D'].map(() => connect(code))
  );
  for (const [index, player] of players.entries()) {
    player.emit('player:join', `Player ${index + 1}`);
    await player.event('lobby:player-data');
  }
  for (const player of players) {
    await player.event('lobby:villagers-list');
  }
  return players;
}

/** Lets the werewolves win at once. */
function finishGame(code: string) {
  return inRoom(code, ({ runtime }) => {
    for (const player of runtime.game.getAlivePlayers()) {
      if (player.getRole() !== 'WEREWOLF') {
        player.kill();
      }
    }
    return runtime.segmentsManager.isGameOver();
  });
}

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
    await startGame('FULL');
    expect(
      await inRoom('FULL', ({ runtime }) =>
        runtime.segmentsManager.hasStarted()
      )
    ).toBe(true);
  });

  it('ignores admin events by default', async () => {
    const [player] = await startGame('ADMIN');
    const dashboard = await connect('ADMIN');
    dashboard.emit('admin:next-segment');
    dashboard.emit('admin:mock-hunter-event');
    await settle();
    expect(
      await inRoom('ADMIN', ({ runtime }) =>
        runtime.segmentsManager.getCurrentSegmentType()
      )
    ).toBe('CUPID');
    expect(player?.events()).not.toContain('alert:action-error');
  });
});

describe('admission', () => {
  it('refuses connections over MAX_CONNECTIONS_PER_ROOM with 503', async () => {
    await Promise.all(Array.from({ length: 6 }, () => connect('CAP')));
    const response = await request('/room/CAP', upgrade);
    expect(response.status).toBe(503);
  });

  const withToken = { ...env, ACCESS_TOKEN: 's3cret' };
  const fetchWith = (url: string, workerEnv: Env & { ACCESS_TOKEN?: string }) =>
    worker.fetch(new Request(url, upgrade), workerEnv);
  const httpRoomUrl = (token?: string) =>
    roomUrl(ORIGIN, 'GATED', token).replace(WS_SCHEME, 'http');

  it.each([
    ['missing', undefined],
    ['wrong', 'guess'],
    ['longer', 's3cret-and-more'],
  ])('answers 401 to a %s token', async (_, token) => {
    const response = await fetchWith(httpRoomUrl(token), withToken);
    expect(response.status).toBe(401);
  });

  it('connects with the right token', async () => {
    const client = await connect(
      'GATED',
      await fetchWith(httpRoomUrl('s3cret'), withToken)
    );
    client.ping(1);
    await client.next((frame) => frame.pong === 1);
  });

  it('is open when no token is configured', async () => {
    const response = await fetchWith(httpRoomUrl(), { ...env });
    expect(response.status).toBe(101);
    await connect('GATED', response);
  });
});

describe('room lifecycle', () => {
  it('leaves no deadline running once the game is finished', async () => {
    await startGame('FINISH');
    expect(
      await inRoom('FINISH', ({ runtime }) =>
        runtime.segmentsManager.getRemainingDeadlineMs()
      )
    ).not.toBeNull();
    expect(await finishGame('FINISH')).toBe(true);
    expect(
      await inRoom('FINISH', ({ runtime }) =>
        runtime.segmentsManager.getRemainingDeadlineMs()
      )
    ).toBeNull();
  });

  it('resets a lobby its last client left', async () => {
    const alice = await connect('LEFT-LOBBY');
    alice.emit('player:join', 'Alice');
    await alice.event('lobby:player-data');
    alice.close();
    await emptied('LEFT-LOBBY');

    const again = await connect('LEFT-LOBBY');
    again.emit('player:join', 'Alice');
    await again.event('lobby:player-data');
  });

  it('resets a finished game its last client left', async () => {
    const players = await startGame('LEFT-DONE');
    await finishGame('LEFT-DONE');
    for (const player of players) {
      player.close();
    }
    await emptied('LEFT-DONE');
    expect(
      await inRoom('LEFT-DONE', ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: false, players: 0 });

    const fresh = await connect('LEFT-DONE');
    fresh.emit('player:join', 'Newcomer');
    await fresh.event('lobby:player-data');
  });

  it('keeps a game in progress for its players to come back', async () => {
    const players = await startGame('LEFT-MID');
    for (const player of players) {
      player.close();
    }
    await emptied('LEFT-MID');
    expect(
      await inRoom('LEFT-MID', ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: true, players: 4 });

    const back = await connect('LEFT-MID');
    back.emit('player:join', 'Player 1');
    await back.event('game:snapshot');
  });
});
