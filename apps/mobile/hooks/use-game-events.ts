import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const [werewolvesVictim, setWerewolvesVictim] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const { playerIsDead } = usePlayerStore();
  const { setModalState, modalState } = useModalStore();
  const router = useRouter();

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

    socket.on('alert:player-is-dead', () => {
      playerIsDead();

      if (modalState.open) {
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
      socket.off('werewolf:pick-required');
      socket.off('alert:player-won');
      socket.off('alert:player-lost');
    };
  }, [modalState.open, setModalState, playerIsDead, router]);

  return {
    werewolvesVictim,
    pendingRedirect,
    setPendingRedirect,
  };
}
