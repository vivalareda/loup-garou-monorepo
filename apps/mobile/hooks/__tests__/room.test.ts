import { RoomApiError } from '@repo/realtime';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectToRoom = vi.fn();
const createRoom = vi.fn();
const roomExists = vi.fn();
vi.mock('@/utils/sockets', () => ({
  socket: { disconnect: vi.fn() },
  connectToRoom: (code: string) => connectToRoom(code),
  createRoom: () => createRoom(),
  roomExists: (code: string) => roomExists(code),
}));

const saveSessionRoom = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/session', () => ({
  getSessionToken: vi.fn(),
  getSessionRoom: vi.fn(),
  clearSessionToken: vi.fn().mockResolvedValue(undefined),
  saveSessionRoom: (code: string) => saveSessionRoom(code),
}));

describe('entering a room', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
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
