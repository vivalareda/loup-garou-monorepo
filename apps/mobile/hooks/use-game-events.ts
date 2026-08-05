import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { clearSessionToken } from '@/utils/session';
import { socket } from '@/utils/sockets';

/** Server rejection reasons (alert:action-error), translated for the banner. */
const ACTION_ERROR_MESSAGES: Record<string, string> = {
  'Cannot start the vote now': 'Impossible de lancer le vote maintenant.',
  'Cupid action is not allowed now': 'Cupidon ne peut pas agir maintenant.',
  'Day vote is not allowed now': 'Le vote du village est fermé.',
  'Game already started': 'La partie a déjà commencé.',
  'Game is finished': 'La partie est terminée.',
  'Game is not finished': "La partie n'est pas terminée.",
  'Hunter pick is not allowed now': 'Le chasseur ne peut pas tirer maintenant.',
  'Invalid Cupid selection': 'Sélection de Cupidon invalide.',
  'Invalid Seer target': 'Cible de la voyante invalide.',
  'Invalid werewolf target': 'Cible des loups-garous invalide.',
  'Lover acknowledgement is not allowed now': 'Action impossible maintenant.',
  'Seer action is not allowed now': 'La voyante ne peut pas agir maintenant.',
  'Vote is out of date': 'Ce vote est obsolète.',
  'Werewolf vote is not allowed now': 'Le vote des loups-garous est fermé.',
  'Witch heal is not allowed now': 'La sorcière ne peut pas soigner maintenant.',
  'Witch poison is not allowed now':
    'La sorcière ne peut pas empoisonner maintenant.',
};

export function translateActionError(message: string) {
  return ACTION_ERROR_MESSAGES[message] ?? message;
}

/** The only routes these listeners ever navigate to. */
export type GameEventRoute =
  | '/'
  | '/death-screen'
  | '/winner-screen'
  | '/loser-screen';

export type GameEventRouter = {
  replace: (path: GameEventRoute) => void;
};

/**
 * Registers every game-level socket listener and returns the cleanup that
 * removes them. Extracted from the hook so it is unit-testable without
 * rendering React (mobile tests run in a plain node environment).
 *
 * Mounted ONCE in `app/(game)/_layout.tsx`, above the individual game
 * routes: a player who dies and is routed to the death screen must keep
 * receiving winner/loser routing and the restart event.
 */
export function registerGameEventListeners(router: GameEventRouter) {
  const { setModalState } = useModalStore.getState();

  socket.once('cupid:pick-required', () => {
    setModalState({
      type: 'CUPID',
      open: true,
    });
  });

  socket.once('alert:player-is-lover', (partnerName) => {
    useGameStore.getState().setLoverPartnerName(partnerName);
    setModalState({
      type: 'LOVER',
      open: true,
    });
  });

  socket.on('seer:pick-required', () => {
    setModalState({
      type: 'SEER',
      open: true,
    });
  });

  socket.on('seer:vision-result', (playerName, role) => {
    useGameStore.getState().setSeerVision({ playerName, role });
    setModalState({
      type: 'SEER-RESULT',
      open: true,
    });
  });

  socket.on('werewolf:pick-required', () => {
    setModalState({
      type: 'WEREWOLVES',
      open: true,
    });
  });

  socket.on('witch:can-heal', (victimSid: string) => {
    useGameStore.getState().setWerewolvesVictim(victimSid);
    setModalState({
      type: 'WITCH-HEAL',
      open: true,
    });
  });

  socket.on('witch:pick-poison-player', () => {
    setModalState({
      type: 'WITCH-POISON',
      open: true,
    });
  });

  socket.on('hunter:pick-required', () => {
    console.log('hunter alert received');
    setModalState({
      type: 'HUNTER',
      open: true,
    });
  });

  socket.on('day:voting-phase-start', () => {
    setModalState({ type: 'DAY-VOTE', open: true });
  });

  socket.on('alert:player-is-dead', () => {
    usePlayerStore.getState().playerIsDead();

    // Defer the redirect while a modal is open so an in-progress action
    // isn't ripped out from under the player; the (game) layout finishes
    // the redirect when the modal closes.
    if (useModalStore.getState().modalState.open) {
      useGameStore.getState().setPendingRedirect(true);
    } else {
      router.replace('/death-screen');
    }
  });

  socket.on('alert:player-won', (result) => {
    console.log('Player won the game!');
    useGameStore.getState().setGameResult(result);
    // The game is over: any still-open prompt (e.g. a hunter pick that
    // timed out) can no longer be answered, and a death redirect deferred
    // behind that modal must not clobber the end screen.
    useGameStore.getState().setPendingRedirect(false);
    useModalStore.getState().closeModal();
    router.replace('/winner-screen');
  });

  socket.on('alert:player-lost', (result) => {
    console.log('Player lost the game!');
    useGameStore.getState().setGameResult(result);
    useGameStore.getState().setPendingRedirect(false);
    useModalStore.getState().closeModal();
    router.replace('/loser-screen');
  });

  socket.on('alert:action-error', (message) => {
    useGameStore.getState().setActionError(translateActionError(message));
  });

  socket.on('game:restarted', () => {
    console.log('Server restarted the game — back to the lobby');
    useGameStore.getState().resetGame();
    usePlayerStore.getState().reset();
    useModalStore.getState().closeModal();
    // The server dropped all players; the old token can never rejoin
    clearSessionToken().catch((error) => {
      console.error('Failed to clear session token', error);
    });
    router.replace('/');
  });

  return () => {
    socket.off('cupid:pick-required');
    socket.off('alert:player-is-lover');
    socket.off('seer:pick-required');
    socket.off('seer:vision-result');
    socket.off('werewolf:pick-required');
    socket.off('witch:can-heal');
    socket.off('witch:pick-poison-player');
    socket.off('hunter:pick-required');
    socket.off('day:voting-phase-start');
    socket.off('alert:player-is-dead');
    socket.off('alert:player-won');
    socket.off('alert:player-lost');
    socket.off('alert:action-error');
    socket.off('game:restarted');
  };
}

export function useGameEvents() {
  const router = useRouter();

  useEffect(
    () =>
      registerGameEventListeners({
        replace: (path) => router.replace(path),
      }),
    [router]
  );
}
