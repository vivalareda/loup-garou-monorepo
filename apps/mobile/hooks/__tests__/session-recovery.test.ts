import type { PlayerGameSnapshot } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyGameSnapshot } from '@/hooks/game-snapshot';
import { registerSessionRecovery } from '@/hooks/session-recovery';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { createFakeGameServer } from './fake-game-server';
import { createMemorySessionTokens } from './memory-session-tokens';

const createRouter = () => ({ replace: vi.fn() });

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('applyGameSnapshot', () => {
  let router = createRouter();
  let sessions = createMemorySessionTokens();

  beforeEach(() => {
    router = createRouter();
    sessions = createMemorySessionTokens();
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

  it('restores state, reopens the pending prompt, and routes into the game', () => {
    applyGameSnapshot(baseSnapshot, router, sessions);

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

  it('persists the session token carried by the snapshot', () => {
    // A seat reclaimed by name arrives with a token the device never stored
    applyGameSnapshot(
      {
        ...baseSnapshot,
        self: { ...baseSnapshot.self, sessionToken: 'recovered-token' },
      },
      router,
      sessions
    );

    expect(sessions.stored()).toBe('recovered-token');
  });

  it('closes a stale modal when the snapshot carries no pending prompt', () => {
    // The phase completed while we were offline: the werewolf modal from
    // before the disconnect must not survive into the new phase
    useModalStore.getState().setModalState({ type: 'WEREWOLVES', open: true });

    applyGameSnapshot(
      { ...baseSnapshot, phase: 'DAY', pendingPrompt: undefined },
      router,
      sessions
    );

    expect(useModalStore.getState().modalState).toEqual({ open: false });
  });

  it('routes a dead player to the death screen', () => {
    applyGameSnapshot(
      {
        ...baseSnapshot,
        pendingPrompt: undefined,
        self: {
          type: 'game',
          name: 'Witch',
          socketId: 'witch-new-sid',
          isAlive: false,
          role: 'WITCH',
        },
      },
      router,
      sessions
    );

    expect(usePlayerStore.getState().isAlive).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/death-screen');
  });

  it('routes to the result screens with the reveal after the game finished', () => {
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
      router,
      sessions
    );

    expect(useGameStore.getState().gameResult).toEqual(gameResult);
    expect(router.replace).toHaveBeenCalledWith('/winner-screen');
  });
});

describe('registerSessionRecovery', () => {
  let router = createRouter();
  let server = createFakeGameServer();
  let sessions = createMemorySessionTokens();

  beforeEach(() => {
    router = createRouter();
    server = createFakeGameServer();
    sessions = createMemorySessionTokens();

    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useConnectionStore.setState({ status: 'connected', recoveryFailed: false });
  });

  const register = () =>
    registerSessionRecovery(router, server.socket, sessions);

  const rejoins = () =>
    server.emitted().filter((frame) => frame.event === 'player:rejoin');

  it('re-identifies with the stored token whenever the socket connects', async () => {
    sessions = createMemorySessionTokens('token-123');
    register();

    server.connect();
    await flushMicrotasks();

    expect(rejoins()).toEqual([
      { event: 'player:rejoin', args: ['token-123'] },
    ]);
  });

  it('attempts the initial restore when the socket connected before registration', async () => {
    sessions = createMemorySessionTokens('token-123');
    server.connect();

    register();
    await flushMicrotasks();

    expect(rejoins()).toEqual([
      { event: 'player:rejoin', args: ['token-123'] },
    ]);
  });

  it('does not rejoin when no token is stored', async () => {
    register();

    server.connect();
    await flushMicrotasks();

    expect(rejoins()).toEqual([]);
  });

  it('tracks reconnecting status while the transport is down', () => {
    register();
    server.connect();

    server.drop();
    expect(useConnectionStore.getState().status).toBe('reconnecting');

    server.connect();
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('resets everything and returns to the join screen when recovery fails mid-game', async () => {
    sessions = createMemorySessionTokens('token-123');
    usePlayerStore.getState().setPlayer({
      type: 'game',
      name: 'Alice',
      socketId: 'alice-sid',
      isAlive: true,
      role: 'WITCH',
    });
    register();
    server.connect();

    server.send('player:rejoin-failed');
    await flushMicrotasks();

    expect(sessions.stored()).toBeNull();
    expect(usePlayerStore.getState().player).toBeNull();
    expect(useConnectionStore.getState().recoveryFailed).toBe(true);
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('silently clears a stale token when recovery fails before any game', async () => {
    sessions = createMemorySessionTokens('token-123');
    register();
    server.connect();

    server.send('player:rejoin-failed');
    await flushMicrotasks();

    expect(sessions.stored()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
