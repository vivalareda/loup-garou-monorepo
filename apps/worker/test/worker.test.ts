import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import {
  type ClientToServerEvents,
  encodeFrame,
  type EventFrame,
  type PongFrame,
  type RoomInfo,
  parseServerFrame,
  roomUrl,
  type ServerFrame,
} from '@repo/types';
import { afterEach, describe, expect, it } from 'vitest';
import type { GameRuntime } from '@/game-runtime';
import type { WebSocketHost } from '@/server/websocket-host';
import worker from '../src/index';

const ORIGIN = 'http://game.test';
const WS_SCHEME = /^ws/;
const open: Client[] = [];

/** A raw WebSocket client of one room, recording every frame it gets. */
class Client {
  readonly frames: ServerFrame[] = [];
  private readonly waiters: (() => void)[] = [];
  private readonly socket: WebSocket;

  constructor(socket: WebSocket) {
    this.socket = socket;
    socket.addEventListener('message', (message) => {
      const frame = parseServerFrame(String(message.data));

      if (!frame) {
        throw new Error(`Malformed server frame: ${String(message.data)}`);
      }

      this.frames.push(frame);

      for (const wake of this.waiters.splice(0)) {
        wake();
      }
    });
  }

  emit(event: keyof ClientToServerEvents, ...args: unknown[]) {
    this.socket.send(encodeFrame({ event, args }));
  }

  ping(n: number) {
    this.socket.send(JSON.stringify({ ping: n }));
  }

  events() {
    return this.frames.flatMap((frame) =>
      'event' in frame ? [frame.event] : []
    );
  }

  /** The first frame matching `match`, waiting up to 2s for it. */
  async next<F extends ServerFrame>(
    match: (frame: ServerFrame) => frame is F
  ): Promise<F> {
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
    return this.next(
      (frame): frame is EventFrame => 'event' in frame && frame.event === name
    );
  }

  /** The first heartbeat reply. */
  pong() {
    return this.next((frame): frame is PongFrame => 'pong' in frame);
  }

  close() {
    this.socket.close(1000);
  }
}

function request(path: string, init?: RequestInit) {
  return exports.default.fetch(`${ORIGIN}${path}`, init);
}

const upgrade = { headers: { Upgrade: 'websocket' } };

/** The code of a room API answer. */
async function readCode(response: Response) {
  // SAFETY: the Worker answers the room API with a RoomInfo (src/index.ts)
  const { code } = (await response.json()) as RoomInfo;

  return code;
}

/** Creates a room through the API and returns its code. */
async function newRoom() {
  const response = await request('/rooms', { method: 'POST' });
  expect(response.status).toBe(201);
  const code = await readCode(response);

  return code;
}

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

const roomStub = (code: string) =>
  env.GAME_ROOM.get(env.GAME_ROOM.idFromName(code));

/** Runs `inspect` inside a room's Durable Object, on its game. */
function inRoom<R>(code: string, inspect: (room: Room) => R) {
  return runInDurableObject(roomStub(code), (instance) => {
    // The game is private to the Durable Object; only tests reach in
    const room = instance['room'];

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

const GENERATED_CODE = /^[2-9A-HJKMNP-TV-Z]{8}$/;

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

  it('rejects a bad code in the room API with 400', async () => {
    const response = await request('/rooms/bad!code');
    expect(response.status).toBe(400);
  });

  it('answers 426 to a room request that is not a WebSocket upgrade', async () => {
    const response = await request('/room/TEST');
    expect(response.status).toBe(426);
    expect(response.headers.get('Upgrade')).toBe('websocket');
  });

  it('accepts a trailing slash and answers the app-level heartbeat', async () => {
    const client = await connect(`${await newRoom()}/`);
    client.ping(7);
    expect(await client.pong()).toEqual({ pong: 7 });
  });
});

describe('creating and finding rooms', () => {
  it('creates rooms with short, distinct, unambiguous codes', async () => {
    const codes = await Promise.all(Array.from({ length: 10 }, newRoom));

    for (const code of codes) {
      expect(code).toMatch(GENERATED_CODE);
    }

    expect(new Set(codes).size).toBe(codes.length);
  });

  it('finds a created room, whatever the case of its code', async () => {
    const code = await newRoom();

    for (const asTyped of [code, code.toLowerCase()]) {
      const response = await request(`/rooms/${asTyped}`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ code });
    }
  });

  it('answers 404 for a code that was never created', async () => {
    const response = await request('/rooms/NEVERMADE');
    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('refuses sockets to a code that was never created', async () => {
    const response = await request('/room/NOSUCHROOM', upgrade);
    expect(response.status).toBe(404);
  });

  it('lets the room API be read from another origin', async () => {
    const response = await request('/rooms', { method: 'POST' });
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

describe('rooms', () => {
  it('sends lobby events to a joining client and its room', async () => {
    const code = await newRoom();
    const alice = await connect(code);
    const bob = await connect(code);

    alice.emit('player:join', 'Alice');
    const data = await alice.event('lobby:player-data');
    expect(data.args[0]).toMatchObject({ name: 'Alice' });
    const update = await bob.event('lobby:update-players-list');
    expect(update.args[0]).toMatchObject({ name: 'Alice' });
  });

  it('isolates rooms from each other', async () => {
    const [redCode, blueCode] = await Promise.all([newRoom(), newRoom()]);
    const red = await connect(redCode);
    const redWatcher = await connect(redCode);
    const blue = await connect(blueCode);

    red.emit('player:join', 'Alice');
    await redWatcher.event('lobby:update-players-list');

    // The same name is free in another room, and nothing crosses over
    blue.emit('player:join', 'Alice');
    await blue.event('lobby:player-data');
    await settle();
    expect(blue.events()).toEqual(['lobby:player-data']);
    expect(redWatcher.events()).toEqual(['lobby:update-players-list']);
  });

  it('keeps each room its own player count', async () => {
    const [bigCode, smallCode] = await Promise.all([newRoom(), newRoom()]);
    const host = await connect(bigCode);
    host.emit('player:join', 'Host');
    await host.event('lobby:player-data');
    host.emit('lobby:set-player-count', 6);
    const lobby = await host.event('lobby:players-list');
    expect(lobby.args?.slice(1)).toEqual([6, expect.any(String)]);

    // Four players start the other room, at the default count
    await startGame(smallCode);
    expect(
      await inRoom(bigCode, ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: false, players: 1 });
  });

  it('starts a game at the count its host picked', async () => {
    const code = await newRoom();

    const players = await Promise.all(
      Array.from({ length: 5 }, () => connect(code))
    );

    const [host, guest] = players;
    host?.emit('player:join', 'Host');
    await host?.event('lobby:player-data');
    guest?.emit('player:join', 'Guest');
    await guest?.event('lobby:player-data');

    guest?.emit('lobby:set-player-count', 5);
    const refused = await guest?.event('alert:action-error');
    expect(refused?.args).toEqual([
      'Only the host can change the player count',
    ]);

    host?.emit('lobby:set-player-count', 5);
    await host?.next(
      (frame): frame is EventFrame =>
        'event' in frame &&
        frame.event === 'lobby:players-list' &&
        frame.args[1] === 5
    );

    for (const [index, player] of players.slice(2).entries()) {
      player.emit('player:join', `Player ${index + 3}`);
      await player.event('lobby:player-data');
    }

    await host?.event('lobby:villagers-list');
    expect(
      await inRoom(code, ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: true, players: 5 });
  });

  it('treats room codes case-insensitively', async () => {
    const code = await newRoom();
    const lower = await connect(code.toLowerCase());
    const upper = await connect(code);

    lower.emit('player:join', 'Alice');
    await lower.event('lobby:player-data');
    upper.emit('player:join', 'alice');
    const rejected = await upper.event('lobby:join-rejected');
    expect(rejected.args).toEqual(['Name already taken']);
  });

  it('starts the game once the room is full', async () => {
    const code = await newRoom();
    await startGame(code);
    expect(
      await inRoom(code, ({ runtime }) => runtime.segmentsManager.hasStarted())
    ).toBe(true);
  });

  it('ignores admin events by default', async () => {
    const code = await newRoom();
    const [player] = await startGame(code);
    const dashboard = await connect(code);
    dashboard.emit('admin:next-segment');
    dashboard.emit('admin:mock-hunter-event');
    await settle();
    expect(
      await inRoom(code, ({ runtime }) =>
        runtime.segmentsManager.getCurrentSegmentType()
      )
    ).toBe('CUPID');
    expect(player?.events()).not.toContain('alert:action-error');
  });
});

/** Calls the Worker directly, so a test can pick its env (ACCESS_TOKEN). */
const fetchWith = (
  url: string,
  workerEnv: Env,
  init: { method?: string; headers?: Record<string, string> } = upgrade
) => worker.fetch(new Request(url, init), workerEnv);

/** The http URL of room `code`, with `token` when given. */
const httpRoomUrl = (code: string, token?: string) =>
  roomUrl(ORIGIN, code, token).replace(WS_SCHEME, 'http');

describe('admission', () => {
  it('refuses connections over MAX_CONNECTIONS_PER_ROOM with 503', async () => {
    const code = await newRoom();
    await Promise.all(Array.from({ length: 6 }, () => connect(code)));
    const response = await request(`/room/${code}`, upgrade);
    expect(response.status).toBe(503);
  });

  const withToken = { ...env, ACCESS_TOKEN: 's3cret' };

  it.each([
    ['missing', undefined],
    ['wrong', 'guess'],
    ['longer', 's3cret-and-more'],
  ])('answers 401 to a %s token', async (_, token) => {
    const code = await newRoom();
    const query = token ? `?token=${token}` : '';

    const responses = await Promise.all([
      fetchWith(httpRoomUrl(code, token), withToken),
      fetchWith(`${ORIGIN}/rooms${query}`, withToken, { method: 'POST' }),
      fetchWith(`${ORIGIN}/rooms/${code}${query}`, withToken, {}),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401,
    ]);
  });

  it('creates, finds and connects with the right token', async () => {
    const created = await fetchWith(`${ORIGIN}/rooms?token=s3cret`, withToken, {
      method: 'POST',
    });

    const code = await readCode(created);

    const found = await fetchWith(
      `${ORIGIN}/rooms/${code}?token=s3cret`,
      withToken,
      {}
    );

    expect(found.status).toBe(200);

    const client = await connect(
      code,
      await fetchWith(httpRoomUrl(code, 's3cret'), withToken)
    );

    client.ping(1);
    expect(await client.pong()).toEqual({ pong: 1 });
  });

  it('is open when no token is configured', async () => {
    const code = await newRoom();
    const response = await fetchWith(httpRoomUrl(code), { ...env });
    expect(response.status).toBe(101);
    await connect(code, response);
  });
});

describe('room lifecycle', () => {
  it('leaves no deadline running once the game is finished', async () => {
    const code = await newRoom();
    await startGame(code);
    expect(
      await inRoom(code, ({ runtime }) =>
        runtime.segmentsManager.getRemainingDeadlineMs()
      )
    ).not.toBeNull();
    expect(await finishGame(code)).toBe(true);
    expect(
      await inRoom(code, ({ runtime }) =>
        runtime.segmentsManager.getRemainingDeadlineMs()
      )
    ).toBeNull();
  });

  it('resets a lobby its last client left', async () => {
    const code = await newRoom();
    const alice = await connect(code);
    alice.emit('player:join', 'Alice');
    await alice.event('lobby:player-data');
    alice.close();
    await emptied(code);

    // The name is free again: the old lobby was reset
    const again = await connect(code);
    again.emit('player:join', 'Alice');
    const data = await again.event('lobby:player-data');
    expect(data.args[0]).toMatchObject({ name: 'Alice' });
  });

  it('resets a finished game its last client left', async () => {
    const code = await newRoom();
    const players = await startGame(code);
    await finishGame(code);

    for (const player of players) {
      player.close();
    }

    await emptied(code);
    expect(
      await inRoom(code, ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: false, players: 0 });

    const fresh = await connect(code);
    fresh.emit('player:join', 'Newcomer');
    await fresh.event('lobby:player-data');
  });

  it('keeps a game in progress for its players to come back', async () => {
    const code = await newRoom();
    const players = await startGame(code);

    for (const player of players) {
      player.close();
    }

    await emptied(code);
    expect(
      await inRoom(code, ({ runtime }) => ({
        started: runtime.segmentsManager.hasStarted(),
        players: runtime.game.getPlayerList().size,
      }))
    ).toEqual({ started: true, players: 4 });

    const back = await connect(code);
    back.emit('player:join', 'Player 1');
    await back.event('game:snapshot');
  });
});

/** Whether the room API still finds room `code`. */
const isFound = async (code: string) =>
  (await request(`/rooms/${code}`)).status === 200;

describe('room expiry', () => {
  it('deletes a room nobody joined', async () => {
    const code = await newRoom();
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect(await isFound(code)).toBe(false);
    expect((await request(`/room/${code}`, upgrade)).status).toBe(404);
  });

  it('deletes a room once its last client left', async () => {
    const code = await newRoom();
    const alice = await connect(code);
    alice.emit('player:join', 'Alice');
    await alice.event('lobby:player-data');
    alice.close();
    await emptied(code);

    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect(await isFound(code)).toBe(false);
  });

  it('keeps a room someone is connected to', async () => {
    const code = await newRoom();
    await connect(code);
    await runDurableObjectAlarm(roomStub(code));
    expect(await isFound(code)).toBe(true);
  });

  it('keeps a game in progress until it ends', async () => {
    const code = await newRoom();
    const players = await startGame(code);

    for (const player of players) {
      player.close();
    }

    await emptied(code);

    await runDurableObjectAlarm(roomStub(code));
    expect(await isFound(code)).toBe(true);
    // Still waiting: the check was rescheduled
    await finishGame(code);
    expect(await runDurableObjectAlarm(roomStub(code))).toBe(true);
    expect(await isFound(code)).toBe(false);
  });
});
