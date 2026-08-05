import type { GameEndResult } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, (...args: unknown[]) => void>();

vi.mock('@/utils/sockets', () => ({
  socket: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
    once: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    emit: vi.fn(),
  },
}));

const clearSessionToken = vi.fn().mockResolvedValue(undefined);
vi.mock('@/utils/session', () => ({
  clearSessionToken: () => clearSessionToken(),
}));

// expo-router ships untranspiled code the node test runner can't parse;
// only the hook wrapper uses it, and these tests drive the plain function
vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const gameEndResult: GameEndResult = {
  winningFaction: 'villagers',
  players: [
    { name: 'Alice', socketId: 'alice-sid', role: 'WITCH', isAlive: false },
    { name: 'Bob', socketId: 'bob-sid', role: 'WEREWOLF', isAlive: false },
  ],
};

describe('registerGameEventListeners', () => {
  let router: { replace: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    listeners.clear();
    clearSessionToken.mockClear();
    router = { replace: vi.fn() };

    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useModalStore.getState().closeModal();
  });

  const register = async () => {
    const { registerGameEventListeners } = await import(
      '@/hooks/use-game-events'
    );
    return registerGameEventListeners(router);
  };

  it('routes a player who died on the first night to the winner screen at game end', async () => {
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useGameStore } = await import('@/hooks/use-game-store');
    await register();

    // Night one: the player dies and is routed to the death screen
    listeners.get('alert:player-is-dead')?.();
    expect(usePlayerStore.getState().isAlive).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/death-screen');

    // Much later: the game ends — the SAME registration (mounted in the
    // (game) layout, not the game-interface screen) must still route them
    listeners.get('alert:player-won')?.(gameEndResult);

    expect(router.replace).toHaveBeenLastCalledWith('/winner-screen');
    expect(useGameStore.getState().gameResult).toEqual(gameEndResult);
  });

  it('routes a dead player to the loser screen and stores the reveal payload', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    await register();

    listeners.get('alert:player-is-dead')?.();
    listeners.get('alert:player-lost')?.(gameEndResult);

    expect(router.replace).toHaveBeenLastCalledWith('/loser-screen');
    expect(useGameStore.getState().gameResult).toEqual(gameEndResult);
  });

  it('defers the death redirect while a modal is open', async () => {
    const { useModalStore } = await import('@/hooks/use-modal-store');
    const { useGameStore } = await import('@/hooks/use-game-store');
    await register();

    useModalStore.getState().setModalState({ type: 'DAY-VOTE', open: true });
    listeners.get('alert:player-is-dead')?.();

    expect(router.replace).not.toHaveBeenCalled();
    expect(useGameStore.getState().pendingRedirect).toBe(true);
  });

  it('resets every store and returns to the join screen on game:restarted', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { usePlayerStore } = await import('@/hooks/use-player-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
    await register();

    // Simulate a finished game's worth of state
    usePlayerStore.getState().setPlayer({
      type: 'game',
      name: 'Alice',
      socketId: 'alice-sid',
      isAlive: false,
      role: 'WITCH',
    });
    usePlayerStore.getState().playerIsDead();
    useGameStore.setState({
      playersList: [{ name: 'Bob', socketId: 'bob-sid' }],
      villagersList: [{ name: 'Bob', socketId: 'bob-sid' }],
      roleAssigned: 'WITCH',
      currentPhase: 'FINISHED',
      playerVote: 'bob-sid',
      isWaitingForPlayers: true,
      werewolvesVictim: 'bob-sid',
      pendingRedirect: true,
      gameResult: gameEndResult,
    });
    useModalStore.getState().setModalState({ type: 'DAY-VOTE', open: true });

    listeners.get('game:restarted')?.();

    const gameState = useGameStore.getState();
    expect(gameState.playersList).toEqual([]);
    expect(gameState.villagersList).toEqual([]);
    expect(gameState.roleAssigned).toBeNull();
    expect(gameState.currentPhase).toBe('LOBBY');
    expect(gameState.playerVote).toBe('');
    expect(gameState.isWaitingForPlayers).toBe(false);
    expect(gameState.werewolvesVictim).toBeNull();
    expect(gameState.pendingRedirect).toBe(false);
    expect(gameState.gameResult).toBeNull();

    expect(usePlayerStore.getState().player).toBeNull();
    expect(usePlayerStore.getState().isAlive).toBe(true);
    expect(useModalStore.getState().modalState.open).toBe(false);
    expect(clearSessionToken).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/');
  });

  it('opens the seer pick modal and stores the vision result', async () => {
    const { useModalStore } = await import('@/hooks/use-modal-store');
    const { useGameStore } = await import('@/hooks/use-game-store');
    await register();

    listeners.get('seer:pick-required')?.();
    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER',
      open: true,
    });

    listeners.get('seer:vision-result')?.('Bob', 'WEREWOLF');
    expect(useGameStore.getState().seerVision).toEqual({
      playerName: 'Bob',
      role: 'WEREWOLF',
    });
    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER-RESULT',
      open: true,
    });
  });

  it('closes any open prompt modal when the game ends', async () => {
    const { useModalStore } = await import('@/hooks/use-modal-store');
    await register();

    // A hunter pick that the server timed out stays open client-side, and
    // the player's death redirect was deferred behind it
    const { useGameStore } = await import('@/hooks/use-game-store');
    useModalStore.getState().setModalState({ type: 'HUNTER', open: true });
    useGameStore.getState().setPendingRedirect(true);
    listeners.get('alert:player-lost')?.(gameEndResult);

    expect(useModalStore.getState().modalState.open).toBe(false);
    // The stale redirect must not clobber the end screen
    expect(useGameStore.getState().pendingRedirect).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith('/loser-screen');

    useModalStore.getState().setModalState({ type: 'DAY-VOTE', open: true });
    listeners.get('alert:player-won')?.(gameEndResult);

    expect(useModalStore.getState().modalState.open).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith('/winner-screen');
  });

  it('surfaces server action errors, translated', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    await register();

    listeners.get('alert:action-error')?.('Cannot start the vote now');
    expect(useGameStore.getState().actionError).toBe(
      'Impossible de lancer le vote maintenant.'
    );

    listeners.get('alert:action-error')?.('Some unknown message');
    expect(useGameStore.getState().actionError).toBe('Some unknown message');
  });

  it('stores the partner name and opens the modal on alert:player-is-lover', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');
    await register();

    listeners.get('alert:player-is-lover')?.('Bob');

    expect(useGameStore.getState().loverPartnerName).toBe('Bob');
    expect(useModalStore.getState().modalState).toEqual({
      type: 'LOVER',
      open: true,
    });
  });

  it('stops routing after cleanup runs', async () => {
    const cleanup = await register();

    cleanup();
    listeners.get('alert:player-won')?.(gameEndResult);

    expect(router.replace).not.toHaveBeenCalled();
  });
});
