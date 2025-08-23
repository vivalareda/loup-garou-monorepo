import type { WerewolvesVoteState } from '@repo/types';
import { useCallback, useEffect, useState } from 'react';
import { socket } from '@/utils/socket';

export function useWerewolfVotes() {
  const [votes, setVotes] = useState<WerewolvesVoteState>({});
  const [playerVote, setPlayerVote] = useState('');
  const [isVotingComplete, setIsVotingComplete] = useState(false);
  const [votingResult, setVotingResult] = useState<string | null>(null);

  useEffect(() => {
    socket.on('werewolf:current-votes', (currentVotes: WerewolvesVoteState) => {
      setVotes(currentVotes);
    });

    socket.on('werewolf:voting-complete', (targetPlayer: string | null) => {
      setIsVotingComplete(true);
      setVotingResult(targetPlayer);
      console.log('Werewolf voting complete. Target:', targetPlayer);
    });

    return () => {
      socket.off('werewolf:current-votes');
      socket.off('werewolf:voting-complete');
    };
  }, []);

  const updateVote = useCallback(
    (targetPlayer: string) => {
      const oldVote = playerVote;
      setPlayerVote(targetPlayer);
      console.log('updating vote', targetPlayer, oldVote);
      socket.emit('werewolf:player-update-vote', targetPlayer, oldVote);
    },
    [playerVote]
  );

  const sendVote = useCallback(
    (targetPlayer: string) => {
      if (playerVote) {
        updateVote(targetPlayer);
        return;
      }

      setPlayerVote(targetPlayer);
      socket.emit('werewolf:player-voted', targetPlayer);
    },
    [updateVote, playerVote]
  );

  const resetVoting = useCallback(() => {
    setIsVotingComplete(false);
    setVotingResult(null);
    setPlayerVote('');
    setVotes({});
  }, []);

  return {
    votes,
    sendVote,
    isVotingComplete,
    votingResult,
    resetVoting,
    playerVote,
  };
}
