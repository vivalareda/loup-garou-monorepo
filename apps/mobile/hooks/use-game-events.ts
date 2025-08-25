import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ModalState } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [werewolvesVictim, setWerewolvesVictim] = useState<string | null>(null);
  const { playerIsDead } = usePlayerStore();
  const router = useRouter();

  useEffect(() => {
    socket.once('cupid:pick-required', () => {
      setModalState({ type: 'CUPID', open: true });
    });

    socket.once('alert:player-is-lover', () => {
      setModalState({ type: 'LOVER', open: true });
    });

    socket.on('werewolf:pick-required', () => {
      setModalState({ type: 'WEREWOLVES', open: true });
    });

    socket.on('witch:can-heal', (victimSid: string) => {
      setWerewolvesVictim(victimSid);
      setModalState({ type: 'WITCH-HEAL', open: true });
    });

    socket.on('alert:player-is-dead', () => {
      playerIsDead();
      router.replace('/death-screen');
    });

    return () => {
      socket.off('werewolf:pick-required');
    };
  }, [playerIsDead, router]);

  return {
    modalState,
    werewolvesVictim,
  };
}
