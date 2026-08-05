import type { PendingPrompt, PlayerGameSnapshot } from '@repo/types';
import { isGamePlayer } from '@repo/types';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { saveSessionToken } from '@/utils/session';

export type SnapshotRoute =
  | '/'
  | '/waiting-room'
  | '/(game)/game-interface'
  | '/death-screen'
  | '/winner-screen'
  | '/loser-screen';

export type SnapshotRouter = {
  replace: (path: SnapshotRoute) => void;
};

function applyPendingPrompt(prompt: PendingPrompt) {
  const { setModalState } = useModalStore.getState();

  switch (prompt.kind) {
    case 'CUPID':
      setModalState({ type: 'CUPID', open: true });
      break;
    case 'LOVERS':
      setModalState({ type: 'LOVER', open: true });
      break;
    case 'SEER':
      setModalState({ type: 'SEER', open: true });
      break;
    case 'WEREWOLF':
      setModalState({ type: 'WEREWOLVES', open: true });
      break;
    case 'WITCH-HEAL':
      useGameStore.getState().setWerewolvesVictim(prompt.victimSid);
      setModalState({ type: 'WITCH-HEAL', open: true });
      break;
    case 'WITCH-POISON':
      setModalState({ type: 'WITCH-POISON', open: true });
      break;
    case 'DAY-VOTE':
      setModalState({ type: 'DAY-VOTE', open: true });
      break;
    case 'HUNTER':
      setModalState({ type: 'HUNTER', open: true });
      break;
    default:
      throw new Error(`Unknown prompt: ${prompt satisfies never}`);
  }
}

/**
 * Rebuild all local game state from a server snapshot (sent after a
 * successful rejoin) and land the player on the screen matching their
 * situation: result screens when finished, the death screen when dead,
 * the waiting room in the lobby, otherwise the game — with the action
 * they still owe the current phase reopened.
 */
export function applyGameSnapshot(
  snapshot: PlayerGameSnapshot,
  router: SnapshotRouter
) {
  const playerStore = usePlayerStore.getState();
  const gameStore = useGameStore.getState();

  // The seat may have been recovered by name (lost token, new phone):
  // persist the token from the snapshot so the NEXT reconnect is automatic
  if (snapshot.self.sessionToken) {
    saveSessionToken(snapshot.self.sessionToken).catch((error) => {
      console.error('Failed to save session token', error);
    });
  }

  playerStore.setPlayer(snapshot.self);
  if (isGamePlayer(snapshot.self)) {
    gameStore.setRoleAssigned(snapshot.self.role);
    if (!snapshot.self.isAlive) {
      playerStore.playerIsDead();
    }
  }

  // Match the live-events behavior: the local list holds the OTHER living
  // players (dead ones are pruned by lobby:player-died as they die)
  gameStore.setPlayersList(
    snapshot.players
      .filter((p) => p.isAlive && p.socketId !== snapshot.self.socketId)
      .map(({ name, socketId }) => ({ name, socketId }))
  );
  gameStore.setCurrentPhase(snapshot.phase);
  gameStore.setCountdown(
    snapshot.countdown
      ? {
          phase: snapshot.countdown.phase,
          endsAt: Date.now() + snapshot.countdown.remainingMs,
        }
      : null
  );
  if (snapshot.gameResult) {
    gameStore.setGameResult(snapshot.gameResult);
  }

  // A modal left open from before the disconnect may belong to a phase that
  // completed while we were gone — the snapshot's prompt is the truth
  useModalStore.getState().closeModal();
  if (snapshot.pendingPrompt) {
    applyPendingPrompt(snapshot.pendingPrompt);
    gameStore.setWaitingForPlayers(false);
  }

  if (snapshot.phase === 'FINISHED' && snapshot.gameResult) {
    router.replace(snapshot.didWin ? '/winner-screen' : '/loser-screen');
    return;
  }

  if (isGamePlayer(snapshot.self) && !snapshot.self.isAlive) {
    router.replace('/death-screen');
    return;
  }

  if (snapshot.phase === 'LOBBY') {
    router.replace('/waiting-room');
    return;
  }

  router.replace('/(game)/game-interface');
}
