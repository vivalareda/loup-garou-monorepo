import { useCallback, useEffect, useState } from 'react';
import { socket } from '@/utils/socket';

export function useWitchActions() {
  const [showHealModal, setShowHealModal] = useState(false);
  const [showPoisonModal, setShowPoisonModal] = useState(false);
  const [werewolfVictimId, setWerewolfVictimId] = useState<string | null>(null);

  useEffect(() => {
    console.log('🧙 [WITCH] Setting up event listeners');

    socket.on('witch:can-heal', (victimSid: string) => {
      console.log('🧙 [WITCH] Received witch:can-heal event', { victimSid });
      setWerewolfVictimId(victimSid);
      setShowHealModal(true);
    });

    socket.on('witch:pick-poison-player', () => {
      console.log('🧙 [WITCH] Received witch:pick-poison-player event');
      setShowPoisonModal(true);
    });

    return () => {
      socket.off('witch:can-heal');
      socket.off('witch:pick-poison-player');
    };
  }, []);

  const healPlayer = useCallback(() => {
    console.log('🧙 [WITCH] Healing player - emitting witch:healed-player');
    socket.emit('witch:healed-player');
    setShowHealModal(false);
    setWerewolfVictimId(null);
  }, []);

  const skipHeal = useCallback(() => {
    console.log('🧙 [WITCH] Skipping heal - emitting witch:skipped-heal');
    socket.emit('witch:skipped-heal');
    setShowHealModal(false);
    setWerewolfVictimId(null);
  }, []);

  const poisonPlayer = useCallback((targetPlayerId: string) => {
    console.log(
      '🧙 [WITCH] Poisoning player - emitting witch:poisoned-player',
      { targetPlayerId }
    );
    socket.emit('witch:poisoned-player', targetPlayerId);
    setShowPoisonModal(false);
  }, []);

  const skipPoison = useCallback(() => {
    console.log('🧙 [WITCH] Skipping poison - emitting witch:skipped-poison');
    socket.emit('witch:skipped-poison');
    setShowPoisonModal(false);
  }, []);

  const closeHealModal = useCallback(() => {
    setShowHealModal(false);
    setWerewolfVictimId(null);
  }, []);

  const closePoisonModal = useCallback(() => {
    setShowPoisonModal(false);
  }, []);

  return {
    showHealModal,
    showPoisonModal,
    werewolfVictimId,
    healPlayer,
    skipHeal,
    poisonPlayer,
    skipPoison,
    closeHealModal,
    closePoisonModal,
  };
}
