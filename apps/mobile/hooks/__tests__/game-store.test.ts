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
});
