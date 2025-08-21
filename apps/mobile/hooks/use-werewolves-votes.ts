import { useCallback, useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

export function useWerewolfVotes() {
  const [votes, setVotes] = useState<Record<string, string>>({});

  useEffect(() => {
    socket.on('werewolf:player-voted', (votesData) => {
      setVotes(votesData);
    });

    return () => socket.off('werewolf:votes-update');
  }, []);

  const sendVote = useCallback((targetPlayer: string) => {
    socket.emit('werewolf:player-voted', targerPlayer);
  }, []);

  return { votes, sendVote };
}
