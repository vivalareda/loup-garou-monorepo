import type { GameEndResult } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerGameEventListeners } from '@/hooks/game-events';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { createFakeGameServer } from './fake-game-server';
import { createMemorySessionTokens } from './memory-session-tokens';

const createRouter = () => ({ replace: vi.fn() });

const gameEndResult: GameEndResult = {
  winningFaction: 'villagers',
  players: [
    { name: 'Alice', socketId: 'alice-sid', role: 'WITCH', isAlive: false },
    { name: 'Bob', socketId: 'bob-sid', role: 'WEREWOLF', isAlive: false },
  ],
};

describe('registerGameEventListeners', () => {
  let router = createRouter();
  let server = createFakeGameServer();
  let sessions = createMemorySessionTokens();

  beforeEach(() => {
    router = createRouter();
    server = createFakeGameServer();
    server.connect();
    sessions = createMemorySessionTokens('token-123');

    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useModalStore.getState().closeModal();
  });

  const register = () =>
    registerGameEventListeners(router, server.socket, sessions);

  it('routes a player who died on the first night to the winner screen at game end', () => {
    register();

    // Night one: the player dies and is routed to the death screen
    server.send('alert:player-is-dead');
    expect(usePlayerStore.getState().isAlive).toBe(false);
    expect(router.replace).toHaveBeenCalledWith('/death-screen');

    // Much later: the game ends — the SAME registration (mounted in the
    // (game) layout, not the game-interface screen) must still route them
    server.send('alert:player-won', gameEndResult);

    expect(router.replace).toHaveBeenLastCalledWith('/winner-screen');
    expect(useGameStore.getState().gameResult).toEqual(gameEndResult);
  });

  it('routes a dead player to the loser screen and stores the reveal payload', () => {
    register();

    server.send('alert:player-is-dead');
    server.send('alert:player-lost', gameEndResult);

    expect(router.replace).toHaveBeenLastCalledWith('/loser-screen');
    expect(useGameStore.getState().gameResult).toEqual(gameEndResult);
  });

  it('defers the death redirect while a modal is open', () => {
    register();

    useModalStore.getState().setModalState({ type: 'DAY-VOTE', open: true });
    server.send('alert:player-is-dead');

    expect(router.replace).not.toHaveBeenCalled();
    expect(useGameStore.getState().pendingRedirect).toBe(true);
  });

  it('resets every store and returns to the join screen on game:restarted', () => {
    register();

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

    server.send('game:restarted');

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
    expect(sessions.stored()).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/join');
  });

  it('opens the seer pick modal and stores the vision result', () => {
    register();

    server.send('seer:pick-required');
    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER',
      open: true,
    });

    server.send('seer:vision-result', 'Bob', 'WEREWOLF');
    expect(useGameStore.getState().seerVision).toEqual({
      playerName: 'Bob',
      role: 'WEREWOLF',
    });
    expect(useModalStore.getState().modalState).toEqual({
      type: 'SEER-RESULT',
      open: true,
    });
  });

  it('closes any open prompt modal when the game ends', () => {
    register();

    // A hunter pick that the server timed out stays open client-side, and
    // the player's death redirect was deferred behind it
    useModalStore.getState().setModalState({ type: 'HUNTER', open: true });
    useGameStore.getState().setPendingRedirect(true);
    server.send('alert:player-lost', gameEndResult);

    expect(useModalStore.getState().modalState.open).toBe(false);
    // The stale redirect must not clobber the end screen
    expect(useGameStore.getState().pendingRedirect).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith('/loser-screen');

    useModalStore.getState().setModalState({ type: 'DAY-VOTE', open: true });
    server.send('alert:player-won', gameEndResult);

    expect(useModalStore.getState().modalState.open).toBe(false);
    expect(router.replace).toHaveBeenLastCalledWith('/winner-screen');
  });

  it('surfaces server action errors, translated', () => {
    register();

    server.send('alert:action-error', 'Cannot start the vote now');
    expect(useGameStore.getState().actionError).toBe(
      'Impossible de lancer le vote maintenant.'
    );

    server.send('alert:action-error', 'Some unknown message');
    expect(useGameStore.getState().actionError).toBe('Some unknown message');
  });

  it('stores the partner name and opens the modal on alert:player-is-lover', () => {
    register();

    server.send('alert:player-is-lover', 'Bob');

    expect(useGameStore.getState().loverPartnerName).toBe('Bob');
    expect(useModalStore.getState().modalState).toEqual({
      type: 'LOVER',
      open: true,
    });
  });

  it('stops routing after cleanup runs', () => {
    const cleanup = register();

    cleanup();
    server.send('alert:player-won', gameEndResult);

    expect(router.replace).not.toHaveBeenCalled();
  });
});
