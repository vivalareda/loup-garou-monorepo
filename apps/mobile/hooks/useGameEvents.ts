import { useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const [showModal, setShowModal] = useState(false);
  const [showLoversAlert, setShowLoversAlert] = useState(false);

  useEffect(() => {
    socket.once('cupid:pick-required', () => {
      setShowModal(true);
    });

    socket.once('alert:player-is-lover', () => {
      setShowLoversAlert(true);
    });

    socket.on('werewolf:pick-required', () => {
      setShowModal(true);
    });

    return () => {
      socket.off('werewolf:pick-required');
    };
  }, []);

  return {
    showModal,
    showLoversAlert,
  };
}
