import type { DeathInfo } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listeners = new Map<string, (...args: unknown[]) => void>();

vi.mock('@/utils/sockets', () => ({
  socket: {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      listeners.set(event, handler);
    }),
    off: vi.fn((event: string) => {
      listeners.delete(event);
    }),
    emit: vi.fn(),
  },
}));

vi.mock('@/hooks/use-player-store', () => ({
  usePlayerStore: {
    getState: () => ({ player: null }),
  },
}));

describe('useGameStore socket listeners', () => {
  beforeEach(async () => {
    listeners.clear();
    const { useGameStore } = await import('@/hooks/use-game-store');
    useGameStore.setState({
      currentPhase: 'LOBBY',
      nightDeaths: [],
      dayVoteTie: [],
      isWaitingForPlayers: true,
    });
  });

  it('prunes a dead player from both the players and villagers lists', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    useGameStore.setState({
      playersList: [
        { name: 'Alice', socketId: 'alice-sid' },
        { name: 'Bob', socketId: 'bob-sid' },
      ],
      villagersList: [
        { name: 'Alice', socketId: 'alice-sid' },
        { name: 'Bob', socketId: 'bob-sid' },
      ],
    });

    useGameStore.getState().initializeSocketListeners();
    listeners.get('lobby:player-died')?.('alice-sid');

    expect(useGameStore.getState().playersList).toEqual([
      { name: 'Bob', socketId: 'bob-sid' },
    ]);
    expect(useGameStore.getState().villagersList).toEqual([
      { name: 'Bob', socketId: 'bob-sid' },
    ]);
  });

  it('stores countdowns and timeout notices, clearing the countdown on phase change', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const before = Date.now();

    useGameStore.getState().initializeSocketListeners();
    listeners.get('game:countdown')?.('DAY-DISCUSSION', 5000);

    const countdown = useGameStore.getState().countdown;
    expect(countdown?.phase).toBe('DAY-DISCUSSION');
    expect(countdown?.endsAt).toBeGreaterThanOrEqual(before + 5000);

    listeners.get('game:phase-timed-out')?.('CUPID');
    expect(useGameStore.getState().phaseTimedOut).toBe('CUPID');

    listeners.get('game:phase-changed')?.('WEREWOLF');
    expect(useGameStore.getState().countdown).toBeNull();
  });

  it('stores phase, night deaths, and day vote ties from server events', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const deaths: DeathInfo[] = [
      {
        playerId: 'player-1',
        playerName: 'Alice',
        cause: 'WEREWOLVES',
        timestamp: new Date(),
      },
    ];

    useGameStore.getState().initializeSocketListeners();
    listeners.get('game:phase-changed')?.('DAY');
    listeners.get('night:deaths-announced')?.(deaths);
    listeners.get('day:vote-tie')?.(['Alice', 'Bob']);

    expect(useGameStore.getState().currentPhase).toBe('DAY');
    expect(useGameStore.getState().isWaitingForPlayers).toBe(false);
    expect(useGameStore.getState().nightDeaths).toEqual(deaths);
    expect(useGameStore.getState().dayVoteTie).toEqual(['Alice', 'Bob']);
  });

  it('returns a placeholder instead of throwing for an unknown socketId', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    useGameStore.setState({
      playersList: [{ name: 'Alice', socketId: 'alice-sid' }],
    });

    expect(useGameStore.getState().getPlayerNameFromSid('alice-sid')).toBe(
      'Alice'
    );
    expect(useGameStore.getState().getPlayerNameFromSid('gone-sid')).toBe(
      'Joueur inconnu'
    );
  });

  it('closes the stale prompt modal when its phase times out', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');

    useGameStore.getState().initializeSocketListeners();
    useModalStore.getState().setModalState({ type: 'HUNTER', open: true });

    listeners.get('game:phase-timed-out')?.('HUNTER');

    expect(useModalStore.getState().modalState.open).toBe(false);
  });

  it('keeps an unrelated modal open when another phase times out', async () => {
    const { useGameStore } = await import('@/hooks/use-game-store');
    const { useModalStore } = await import('@/hooks/use-modal-store');

    useGameStore.getState().initializeSocketListeners();
    useModalStore.getState().setModalState({ type: 'SEER-RESULT', open: true });

    listeners.get('game:phase-timed-out')?.('WEREWOLF');

    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER-RESULT',
      open: true,
    });
  });
});
