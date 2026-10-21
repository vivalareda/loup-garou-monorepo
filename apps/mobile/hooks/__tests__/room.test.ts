import { RoomApiError } from '@repo/realtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRooms } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { createFakeGameServer } from './fake-game-server';
import { createFakeRoomServer } from './fake-room-server';
import {
  createMemorySessionTokens,
  createSlowReadSessionTokens,
} from './memory-session-tokens';

let server = createFakeGameServer();
let roomServer = createFakeRoomServer();
let sessions = createMemorySessionTokens();
let savedRoom = createMemorySessionTokens();

const buildRooms = () =>
  createRooms(server.socket, roomServer, sessions, savedRoom);

beforeEach(() => {
  server = createFakeGameServer();
  roomServer = createFakeRoomServer();
  sessions = createMemorySessionTokens();
  savedRoom = createMemorySessionTokens();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  useConnectionStore.setState({ roomCode: null });
});

describe('entering a room', () => {
  it('creates a room and connects to it', async () => {
    roomServer.create.mockResolvedValue('K7MQ3XPD');

    expect(await buildRooms().createAndEnter()).toEqual({
      ok: true,
      code: 'K7MQ3XPD',
    });
    expect(roomServer.connect).toHaveBeenCalledWith('K7MQ3XPD');
    expect(savedRoom.stored()).toBe('K7MQ3XPD');
    expect(useConnectionStore.getState().roomCode).toBe('K7MQ3XPD');
  });

  it('joins a typed code whatever its case and separators', async () => {
    roomServer.exists.mockResolvedValue(true);

    expect(await buildRooms().joinByCode(' k7mq-3xpd ')).toEqual({
      ok: true,
      code: 'K7MQ3XPD',
    });
    expect(roomServer.exists).toHaveBeenCalledWith('K7MQ3XPD');
    expect(roomServer.connect).toHaveBeenCalledWith('K7MQ3XPD');
  });

  it('reports a code with no room without connecting', async () => {
    roomServer.exists.mockResolvedValue(false);

    expect(await buildRooms().joinByCode('WRONG234')).toEqual({
      ok: false,
      error: 'Aucune partie avec ce code.',
    });
    expect(roomServer.connect).not.toHaveBeenCalled();
  });

  it('refuses an empty or malformed code without asking the server', async () => {
    const rooms = buildRooms();

    for (const input of ['', '  ', 'abc!']) {
      expect((await rooms.joinByCode(input)).ok).toBe(false);
    }

    expect(roomServer.exists).not.toHaveBeenCalled();
  });

  it('tells a refused token from an unreachable server', async () => {
    const rooms = buildRooms();
    roomServer.create.mockRejectedValueOnce(new RoomApiError(401, 'no'));
    roomServer.create.mockRejectedValueOnce(
      new TypeError('Network request failed')
    );

    expect(await rooms.createAndEnter()).toEqual({
      ok: false,
      error: 'Accès refusé par le serveur.',
    });
    expect(await rooms.createAndEnter()).toMatchObject({ ok: false });
    expect(roomServer.connect).not.toHaveBeenCalled();
  });
});

const playInRoomA = () => {
  usePlayerStore.getState().setPlayer({
    type: 'game',
    name: 'Alice',
    socketId: 'alice-sid',
    isAlive: true,
    role: 'WITCH',
  });
  useGameStore.getState().setRoleAssigned('WITCH');
  useModalStore.getState().setModalState({ type: 'WITCH-HEAL', open: true });
};

const expectNoGameLeft = () => {
  expect(usePlayerStore.getState().player).toBeNull();
  expect(useGameStore.getState().roleAssigned).toBeNull();
  expect(useModalStore.getState().modalState.open).toBe(false);
};

describe('changing rooms', () => {
  it('leaving a room forgets its game', () => {
    sessions = createMemorySessionTokens('token-from-a');
    useConnectionStore.setState({ roomCode: 'ROOMA234' });
    server.connect();
    playInRoomA();

    buildRooms().leave();

    expect(server.socket.connected).toBe(false);
    expect(useConnectionStore.getState().roomCode).toBeNull();
    expect(sessions.stored()).toBeNull();
    expectNoGameLeft();
  });

  it('entering another room forgets the previous game', async () => {
    playInRoomA();
    roomServer.exists.mockResolvedValue(true);

    await buildRooms().joinByCode('ROOMB234');

    expect(roomServer.connect).toHaveBeenCalledWith('ROOMB234');
    expectNoGameLeft();
  });
});

describe('room entries', () => {
  it('re-entering the current room starts over on a new connection', async () => {
    const rooms = buildRooms();
    const disconnect = vi.spyOn(server.socket, 'disconnect');
    const clearSession = vi.spyOn(sessions, 'clear');
    roomServer.exists.mockResolvedValue(true);

    await rooms.joinByCode('ROOMA234');
    await rooms.joinByCode('ROOMA234');

    // Each entry closes the previous connection and opens a new one, and
    // drops the session token of the earlier entry
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(roomServer.connect).toHaveBeenCalledTimes(2);
    expect(clearSession).toHaveBeenCalledTimes(2);
  });

  it('a relaunch restore never overrides a room picked meanwhile', async () => {
    const slowSessions = createSlowReadSessionTokens();
    sessions = slowSessions;
    savedRoom = createMemorySessionTokens('ROOMA234');
    const rooms = buildRooms();
    roomServer.exists.mockResolvedValue(true);

    const restoring = rooms.restore();
    await rooms.joinByCode('ROOMB234');
    slowSessions.finishRead('token-from-a');
    await restoring;

    expect(roomServer.connect).toHaveBeenCalledExactlyOnceWith('ROOMB234');
    expect(useConnectionStore.getState().roomCode).toBe('ROOMB234');
  });

  it('a relaunch restore rejoins the saved room, keeping its token', async () => {
    sessions = createMemorySessionTokens('token-from-a');
    savedRoom = createMemorySessionTokens('ROOMA234');

    await buildRooms().restore();

    expect(roomServer.connect).toHaveBeenCalledExactlyOnceWith('ROOMA234');
    expect(sessions.stored()).toBe('token-from-a');
  });
});
