import type { DeathInfo } from '@repo/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { createFakeGameServer, type FakeGameServer } from './fake-game-server';

describe('useGameStore socket listeners', () => {
  let server: FakeGameServer;

  beforeEach(() => {
    server = createFakeGameServer();
    server.connect();
    usePlayerStore.getState().reset();
    useGameStore.setState({
      currentPhase: 'LOBBY',
      nightDeaths: [],
      dayVoteTie: [],
      isWaitingForPlayers: true,
    });
  });

  it('prunes a dead player from both the players and villagers lists', () => {
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

    useGameStore.getState().initializeSocketListeners(server.socket);
    server.send('lobby:player-died', 'alice-sid');

    expect(useGameStore.getState().playersList).toEqual([
      { name: 'Bob', socketId: 'bob-sid' },
    ]);
    expect(useGameStore.getState().villagersList).toEqual([
      { name: 'Bob', socketId: 'bob-sid' },
    ]);
  });

  it('stores countdowns and timeout notices, clearing the countdown on phase change', () => {
    const before = Date.now();

    useGameStore.getState().initializeSocketListeners(server.socket);
    server.send('game:countdown', 'DAY-DISCUSSION', 5000);

    const countdown = useGameStore.getState().countdown;
    expect(countdown?.phase).toBe('DAY-DISCUSSION');
    expect(countdown?.endsAt).toBeGreaterThanOrEqual(before + 5000);

    server.send('game:phase-timed-out', 'CUPID');
    expect(useGameStore.getState().phaseTimedOut).toBe('CUPID');

    server.send('game:phase-changed', 'WEREWOLF');
    expect(useGameStore.getState().countdown).toBeNull();
  });

  it('stores phase, night deaths, and day vote ties from server events', () => {
    const deaths: DeathInfo[] = [
      {
        playerId: 'player-1',
        playerName: 'Alice',
        cause: 'WEREWOLVES',
        timestamp: new Date(),
      },
    ];

    useGameStore.getState().initializeSocketListeners(server.socket);
    server.send('game:phase-changed', 'DAY');
    server.send('night:deaths-announced', deaths);
    server.send('day:vote-tie', ['Alice', 'Bob']);

    expect(useGameStore.getState().currentPhase).toBe('DAY');
    expect(useGameStore.getState().isWaitingForPlayers).toBe(false);
    // The timestamp crosses the wire as JSON: it arrives as an ISO string
    expect(useGameStore.getState().nightDeaths).toEqual(
      JSON.parse(JSON.stringify(deaths))
    );
    expect(useGameStore.getState().dayVoteTie).toEqual(['Alice', 'Bob']);
  });

  it('returns a placeholder instead of throwing for an unknown socketId', () => {
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

  it('closes the stale prompt modal when its phase times out', () => {
    useGameStore.getState().initializeSocketListeners(server.socket);
    useModalStore.getState().setModalState({ type: 'HUNTER', open: true });

    server.send('game:phase-timed-out', 'HUNTER');

    expect(useModalStore.getState().modalState.open).toBe(false);
  });

  it('keeps an unrelated modal open when another phase times out', () => {
    useGameStore.getState().initializeSocketListeners(server.socket);
    useModalStore.getState().setModalState({ type: 'SEER-RESULT', open: true });

    server.send('game:phase-timed-out', 'WEREWOLF');

    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER-RESULT',
      open: true,
    });
  });
});
