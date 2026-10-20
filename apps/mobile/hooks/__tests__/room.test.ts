import { RoomApiError } from '@repo/realtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectToRoom = vi.fn();
const createRoom = vi.fn();
const roomExists = vi.fn();
vi.mock('@/utils/sockets', () => ({
  socket: { disconnect: () => disconnect() },
  connectToRoom: (code: string) => connectToRoom(code),
  createRoom: () => createRoom(),
  roomExists: (code: string) => roomExists(code),
}));

const disconnect = vi.fn();
const saveSessionRoom = vi.fn().mockResolvedValue(undefined);
const getSessionToken = vi.fn();
const getSessionRoom = vi.fn();
const clearSessionToken = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/session', () => ({
  getSessionToken: () => getSessionToken(),
  getSessionRoom: () => getSessionRoom(),
  clearSessionToken: () => clearSessionToken(),
  saveSessionRoom: (code: string) => saveSessionRoom(code),
}));

describe('entering a room', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    clearSessionToken.mockResolvedValue(undefined);
    saveSessionRoom.mockResolvedValue(undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    useConnectionStore.setState({ roomCode: null });
  });

  it('creates a room and connects to it', async () => {
    const { createAndEnterRoom } = await import('@/hooks/room');
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    createRoom.mockResolvedValue('K7MQ3XPD');

    expect(await createAndEnterRoom()).toEqual({ ok: true, code: 'K7MQ3XPD' });
    expect(connectToRoom).toHaveBeenCalledWith('K7MQ3XPD');
    expect(saveSessionRoom).toHaveBeenCalledWith('K7MQ3XPD');
    expect(useConnectionStore.getState().roomCode).toBe('K7MQ3XPD');
  });

  it('joins a typed code whatever its case and separators', async () => {
    const { joinRoomByCode } = await import('@/hooks/room');
    roomExists.mockResolvedValue(true);

    expect(await joinRoomByCode(' k7mq-3xpd ')).toEqual({
      ok: true,
      code: 'K7MQ3XPD',
    });
    expect(roomExists).toHaveBeenCalledWith('K7MQ3XPD');
    expect(connectToRoom).toHaveBeenCalledWith('K7MQ3XPD');
  });

  it('reports a code with no room without connecting', async () => {
    const { joinRoomByCode } = await import('@/hooks/room');
    roomExists.mockResolvedValue(false);

    expect(await joinRoomByCode('WRONG234')).toEqual({
      ok: false,
      error: 'Aucune partie avec ce code.',
    });
    expect(connectToRoom).not.toHaveBeenCalled();
  });

  it('refuses an empty or malformed code without asking the server', async () => {
    const { joinRoomByCode } = await import('@/hooks/room');
    for (const input of ['', '  ', 'abc!']) {
      expect((await joinRoomByCode(input)).ok).toBe(false);
    }
    expect(roomExists).not.toHaveBeenCalled();
  });

  it('tells a refused token from an unreachable server', async () => {
    const { createAndEnterRoom } = await import('@/hooks/room');
    createRoom.mockRejectedValueOnce(new RoomApiError(401, 'no'));
    createRoom.mockRejectedValueOnce(new TypeError('Network request failed'));

    expect(await createAndEnterRoom()).toEqual({
      ok: false,
      error: 'Accès refusé par le serveur.',
    });
    expect(await createAndEnterRoom()).toMatchObject({ ok: false });
    expect(connectToRoom).not.toHaveBeenCalled();
  });
});

describe('changing rooms', () => {
  const playInRoomA = async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
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

  const expectNoGameLeft = async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
    expect(usePlayerStore.getState().player).toBeNull();
    expect(useGameStore.getState().roleAssigned).toBeNull();
    expect(useModalStore.getState().modalState.open).toBe(false);
  };

  it('leaving a room forgets its game', async () => {
    const { leaveRoom } = await import('@/hooks/room');
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    await playInRoomA();

    leaveRoom();

    expect(disconnect).toHaveBeenCalled();
    expect(useConnectionStore.getState().roomCode).toBeNull();
    await expectNoGameLeft();
  });

  it('entering another room forgets the previous game', async () => {
    const { joinRoomByCode } = await import('@/hooks/room');
    await playInRoomA();
    roomExists.mockResolvedValue(true);

    await joinRoomByCode('ROOMB234');

    await expectNoGameLeft();
  });
});

describe('room entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionToken.mockResolvedValue(undefined);
    saveSessionRoom.mockResolvedValue(undefined);
  });

  it('re-entering the current room starts over on a new connection', async () => {
    const { joinRoomByCode } = await import('@/hooks/room');
    roomExists.mockResolvedValue(true);

    await joinRoomByCode('ROOMA234');
    await joinRoomByCode('ROOMA234');

    // Each entry closes the previous connection and opens a new one, and
    // drops the session token of the earlier entry
    expect(disconnect).toHaveBeenCalledTimes(2);
    expect(connectToRoom).toHaveBeenCalledTimes(2);
    expect(clearSessionToken).toHaveBeenCalledTimes(2);
  });

  it('a relaunch restore never overrides a room picked meanwhile', async () => {
    const { joinRoomByCode, restoreRoom } = await import('@/hooks/room');
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    let finishRead: (token: string) => void = () => undefined;
    getSessionToken.mockReturnValue(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      })
    );
    getSessionRoom.mockResolvedValue('ROOMA234');
    roomExists.mockResolvedValue(true);

    const restoring = restoreRoom();
    await joinRoomByCode('ROOMB234');
    finishRead('token-from-a');
    await restoring;

    expect(connectToRoom).toHaveBeenCalledExactlyOnceWith('ROOMB234');
    expect(useConnectionStore.getState().roomCode).toBe('ROOMB234');
  });

  it('a relaunch restore rejoins the saved room, keeping its token', async () => {
    const { restoreRoom } = await import('@/hooks/room');
    getSessionToken.mockResolvedValue('token-from-a');
    getSessionRoom.mockResolvedValue('ROOMA234');

    await restoreRoom();

    expect(connectToRoom).toHaveBeenCalledExactlyOnceWith('ROOMA234');
    expect(clearSessionToken).not.toHaveBeenCalled();
  });
});
