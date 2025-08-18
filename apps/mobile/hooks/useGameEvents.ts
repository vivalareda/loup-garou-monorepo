import { useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const [showPickModal, setShowPickModal] = useState(false);

  useEffect(() => {
    socket.once('action:cupid-pick-required', () => {
      setShowPickModal(true);
    });
  }, []);

  return {
    showPickModal,
  };
}
