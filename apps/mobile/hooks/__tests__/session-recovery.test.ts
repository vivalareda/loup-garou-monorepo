import type { PlayerGameSnapshot } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
const emit = vi.fn();
const disconnect = vi.fn();
const roomExists = vi.fn();
let socketConnected = false;

vi.mock('@/utils/sockets', () => ({
  socket: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const list = listeners.get(event) ?? [];
      list.push(handler);
      listeners.set(event, list);
    }),
    once: vi.fn(),
    off: vi.fn((event: string, handler?: (...args: unknown[]) => void) => {
      if (!handler) {
        listeners.delete(event);
        return;
      }
      const list = (listeners.get(event) ?? []).filter((h) => h !== handler);
      listeners.set(event, list);
    }),
    emit,
    disconnect,
    get connected() {
      return socketConnected;
    },
  },
  roomExists: (code: string) => roomExists(code),
}));

const getSessionToken = vi.fn();
const clearSessionToken = vi.fn().mockResolvedValue(undefined);
const saveSessionToken = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/session', () => ({
  getSessionToken: () => getSessionToken(),
  clearSessionToken: () => clearSessionToken(),
  saveSessionToken: (token: string) => saveSessionToken(token),
  getSessionRoom: vi.fn(),
  saveSessionRoom: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const fire = (event: string, ...args: unknown[]) => {
  for (const handler of listeners.get(event) ?? []) {
    handler(...args);
  }
};

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('applyGameSnapshot', () => {
  let router: { replace: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    router = { replace: vi.fn() };
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useModalStore.getState().closeModal();
  });

  const baseSnapshot: PlayerGameSnapshot = {
    phase: 'WITCH-HEAL',
    players: [
      { name: 'Witch', socketId: 'witch-new-sid', isAlive: true },
      { name: 'Wolf', socketId: 'wolf-sid', isAlive: true },
      { name: 'Dead', socketId: 'dead-sid', isAlive: false },
    ],
    self: {
      type: 'game',
      name: 'Witch',
      socketId: 'witch-new-sid',
      isAlive: true,
      role: 'WITCH',
    },
    pendingPrompt: {
      kind: 'WITCH-HEAL',
      victimSid: 'wolf-sid',
      victimName: 'Wolf',
    },
  };

  it('restores state, reopens the pending prompt, and routes into the game', async () => {
    const { applyGameSnapshot } = await import('@/hooks/game-snapshot');
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');

    applyGameSnapshot(baseSnapshot, router);

    expect(usePlayerStore.getState().player?.socketId).toBe('witch-new-sid');
    expect(useGameStore.getState().currentPhase).toBe('WITCH-HEAL');
    // Roster excludes self and the dead
    expect(useGameStore.getState().playersList).toEqual([
      { name: 'Wolf', socketId: 'wolf-sid' },
    ]);
    expect(useGameStore.getState().werewolvesVictim).toBe('wolf-sid');
    expect(useModalStore.getState().modalState).toEqual({
      type: 'WITCH-HEAL',
      open: true,
    });
    expect(router.replace).toHaveBeenCalledWith('/(game)/game-interface');
  });

  it('persists the session token carried by the snapshot', async () => {
    const { applyGameSnapshot } = await import('@/hooks/game-snapshot');
    saveSessionToken.mockClear();

    // A seat reclaimed by name arrives with a token the device never stored
    applyGameSnapshot(
      {
        ...baseSnapshot,
        self: { ...baseSnapshot.self, sessionToken: 'recovered-token' },
      },
      router
    );

    expect(saveSessionToken).toHaveBeenCalledWith('recovered-token');
  });

  it('closes a stale modal when the snapshot carries no pending prompt', async () => {
    const { applyGameSnapshot } = await import('@/hooks/game-snapshot');
    const { useModalStore } = await import('@/hooks/use-modal-store');

    // The phase completed while we were offline: the werewolf modal from
    // before the disconnect must not survive into the new phase
    useModalStore.getState().setModalState({ type: 'WEREWOLVES', open: true });

    applyGameSnapshot(
      { ...baseSnapshot, phase: 'DAY', pendingPrompt: undefined },
      router
    );

    expect(useModalStore.getState().modalState).toEqual({ open: false });
  });

  it('routes a dead player to the death screen', async () => {
    const { applyGameSnapshot } = await import('@/hooks/game-snapshot');
    const { usePlayerStore } = await import('@/hooks/use-player-store');

    applyGameSnapshot(
      {
        ...baseSnapshot,
        pendingPrompt: undefined,
        self: { ...baseSnapshot.self, isAlive: false, type: 'game' },
      } as PlayerGameSnapshot,
      router
    );

    expect(usePlayerStore.getState().isAlive).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/death-screen');
  });

  it('routes to the result screens with the reveal after the game finished', async () => {
    const { applyGameSnapshot } = await import('@/hooks/game-snapshot');
    const { useGameStore } = await import('@/hooks/use-game-store');
    const gameResult = {
      winningFaction: 'villagers' as const,
      players: [],
    };

    applyGameSnapshot(
      {
        ...baseSnapshot,
        phase: 'FINISHED',
        pendingPrompt: undefined,
        gameResult,
        didWin: true,
      },
      router
    );

    expect(useGameStore.getState().gameResult).toEqual(gameResult);
    expect(router.replace).toHaveBeenCalledWith('/winner-screen');
  });
});

describe('registerSessionRecovery', () => {
  let router: { replace: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    listeners.clear();
    emit.mockClear();
    getSessionToken.mockReset();
    clearSessionToken.mockClear();
    socketConnected = false;
    router = { replace: vi.fn() };

    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useConnectionStore.setState({
      status: 'connected',
      recoveryFailed: false,
      roomCode: null,
    });
  });

  const register = async () => {
    const { registerSessionRecovery } = await import(
      '@/hooks/use-session-recovery'
    );
    return registerSessionRecovery(router);
  };

  it('re-identifies with the stored token whenever the socket connects', async () => {
    getSessionToken.mockResolvedValue('token-123');
    await register();

    fire('connect');
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledWith('player:rejoin', 'token-123');
  });

  it('does not send a token read that finished after a room change', async () => {
    const { leaveRoom } = await import('@/hooks/room');
    let finishRead: (token: string) => void = () => undefined;
    getSessionToken.mockReturnValue(
      new Promise<string>((resolve) => {
        finishRead = resolve;
      })
    );
    await register();

    fire('connect');
    // The player moves on while the token is still being read
    leaveRoom();
    finishRead('token-from-room-a');
    await flushMicrotasks();

    expect(emit).not.toHaveBeenCalled();
  });

  it('attempts the initial restore when the socket connected before registration', async () => {
    getSessionToken.mockResolvedValue('token-123');
    socketConnected = true;

    await register();
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledWith('player:rejoin', 'token-123');
  });

  it('does not rejoin when no token is stored', async () => {
    getSessionToken.mockResolvedValue(null);
    await register();

    fire('connect');
    await flushMicrotasks();

    expect(emit).not.toHaveBeenCalled();
  });

  it('tracks reconnecting status while the transport is down', async () => {
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    getSessionToken.mockResolvedValue(null);
    await register();

    fire('disconnect');
    expect(useConnectionStore.getState().status).toBe('reconnecting');

    fire('connect');
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('resets everything and returns to the join screen when recovery fails mid-game', async () => {
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    getSessionToken.mockResolvedValue('token-123');
    usePlayerStore.getState().setPlayer({
      type: 'game',
      name: 'Alice',
      socketId: 'alice-sid',
      isAlive: true,
      role: 'WITCH',
    });
    await register();

    fire('player:rejoin-failed');
    await flushMicrotasks();

    expect(clearSessionToken).toHaveBeenCalled();
    expect(usePlayerStore.getState().player).toBeNull();
    expect(useConnectionStore.getState().recoveryFailed).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/join');
  });

  describe('when a reconnect is refused', () => {
    beforeEach(async () => {
      const { useConnectionStore } = await import(
        '@/hooks/use-connection-store'
      );
      useConnectionStore.setState({ roomCode: 'ABCD2345' });
      roomExists.mockReset();
      disconnect.mockClear();
    });

    it('leaves a room that no longer exists', async () => {
      const { useConnectionStore } = await import(
        '@/hooks/use-connection-store'
      );
      roomExists.mockResolvedValue(false);
      await register();

      fire('connect_error', new Error('closed before opening'));
      await flushMicrotasks();

      expect(roomExists).toHaveBeenCalledWith('ABCD2345');
      expect(disconnect).toHaveBeenCalled();
      expect(useConnectionStore.getState().roomCode).toBeNull();
      expect(router.replace).toHaveBeenCalledWith('/');
    });

    it('keeps reconnecting to a room that still exists', async () => {
      roomExists.mockResolvedValue(true);
      await register();

      fire('connect_error', new Error('closed before opening'));
      await flushMicrotasks();

      expect(disconnect).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    });

    it('keeps reconnecting while the server is unreachable', async () => {
      roomExists.mockRejectedValue(new TypeError('Network request failed'));
      await register();

      fire('connect_error', new Error('closed before opening'));
      await flushMicrotasks();

      expect(disconnect).not.toHaveBeenCalled();
    });
  });

  it("sends a relaunched app whose seat is gone to its room's join screen", async () => {
    const { useConnectionStore } = await import('@/hooks/use-connection-store');
    // restoreRoom() reconnected to the saved room; no player restored yet
    useConnectionStore.setState({ roomCode: 'ABCD2345' });
    getSessionToken.mockResolvedValue('token-123');
    await register();

    fire('player:rejoin-failed');
    await flushMicrotasks();

    expect(clearSessionToken).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/join');
  });

  it('silently clears a stale token when recovery fails outside any room', async () => {
    getSessionToken.mockResolvedValue('token-123');
    await register();

    fire('player:rejoin-failed');
    await flushMicrotasks();

    expect(clearSessionToken).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
