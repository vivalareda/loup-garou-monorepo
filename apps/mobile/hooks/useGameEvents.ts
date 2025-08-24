import { useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

type ModalState =
  | { type: 'CUPID'; open: true }
  | { type: 'LOVER'; open: true }
  | { type: 'WEREWOLVES'; open: true }
  | { type: 'WITCH-HEAL'; open: true }
  | { type: 'WITCH-POISON'; open: true }
  | { open: false };

export function useGameEvents() {
  const [modalState, setModalState] = useState<ModalState>({ open: false });
  const [werewolvesVictim, setWerewolvesVictim] = useState<string | null>(null);

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

    return () => {
      socket.off('werewolf:pick-required');
    };
  }, []);

  return {
    modalState,
    werewolvesVictim,
  };
}
