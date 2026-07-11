import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const [werewolvesVictim, setWerewolvesVictim] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const { playerIsDead } = usePlayerStore();
  const { setModalState, modalState } = useModalStore();
  const router = useRouter();

  // Keep latest modalState.open accessible inside long-lived socket
  // handlers without re-subscribing listeners on every open/close toggle
  // (the previous dep array re-ran the effect on every modal change,
  // stacking the 5 listeners that weren't cleaned up).
  const modalOpenRef = useRef(modalState.open);
  useEffect(() => {
    modalOpenRef.current = modalState.open;
  }, [modalState.open]);

  useEffect(() => {
    socket.once('cupid:pick-required', () => {
      setModalState({
        type: 'CUPID',
        open: true,
      });
    });

    socket.once('alert:player-is-lover', () => {
      setModalState({
        type: 'LOVER',
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
      setWerewolvesVictim(victimSid);
      setModalState({
        type: 'WITCH-HEAL',
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
      playerIsDead();

      if (modalOpenRef.current) {
        setPendingRedirect(true);
      } else {
        router.replace('/death-screen');
      }
    });

    socket.on('alert:player-won', () => {
      console.log('Player won the game!');
      router.replace('/winner-screen');
    });

    socket.on('alert:player-lost', () => {
      console.log('Player lost the game!');
      router.replace('/loser-screen');
    });

    return () => {
      socket.off('cupid:pick-required');
      socket.off('alert:player-is-lover');
      socket.off('werewolf:pick-required');
      socket.off('witch:can-heal');
      socket.off('hunter:pick-required');
      socket.off('day:voting-phase-start');
      socket.off('alert:player-is-dead');
      socket.off('alert:player-won');
      socket.off('alert:player-lost');
    };
  }, [setModalState, playerIsDead, router]);

  return {
    werewolvesVictim,
    pendingRedirect,
    setPendingRedirect,
  };
}
