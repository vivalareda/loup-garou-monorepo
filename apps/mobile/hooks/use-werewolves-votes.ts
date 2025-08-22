import type { WerewolvesVoteState } from '@repo/types';
import { useCallback, useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

export function useWerewolfVotes() {
  const [votes, setVotes] = useState<WerewolvesVoteState>({});
  const [playerVote, setPlayerVote] = useState('');
  const [isVotingComplete, setIsVotingComplete] = useState(false);
  const [votingResult, setVotingResult] = useState<string | null>(null);
  const mockModal = process.env.EXPO_PUBLIC_MOCK_MODAL === 'true';
  const [mockVotes, setMockVotes] = useState<WerewolvesVoteState>({
    Alice: 1,
    Bob: 2,
    Charlie: 3,
    Diana: 3,
    Eve: 5,
  });

  useEffect(() => {
    if (mockModal) {
      setVotes(mockVotes);
      return;
    }
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
  }, [mockModal, mockVotes]);

  useEffect(() => {
    if (!mockModal) {
      return;
    }

    socket.on(
      'werewolf:player-update-vote',
      (targetPlayer: string, oldVote: string) => {
        const newMockVotes = { ...mockVotes };
        newMockVotes[targetPlayer] = (newMockVotes[targetPlayer] || 0) + 1;
        newMockVotes[oldVote] = Math.max(0, (newMockVotes[oldVote] || 0) - 1);
        setMockVotes(newMockVotes);
      }
    );

    return () => {
      socket.off('werewolf:player-update-vote');
    };
  }, [mockModal, mockVotes]);

  const updateVote = useCallback(
    (targetPlayer: string) => {
      const oldVote = playerVote;
      setPlayerVote(targetPlayer);
      console.log('updating vote', targetPlayer, oldVote);

      if (mockModal) {
        const newMockVotes = { ...mockVotes };
        newMockVotes[targetPlayer] = (newMockVotes[targetPlayer] || 0) + 1;
        newMockVotes[oldVote] = Math.max(0, (newMockVotes[oldVote] || 0) - 1);
        setMockVotes(newMockVotes);
      } else {
        socket.emit('werewolf:player-update-vote', targetPlayer, oldVote);
      }
    },
    [playerVote, mockModal, mockVotes]
  );

  const sendVote = useCallback(
    (targetPlayer: string) => {
      if (playerVote) {
        updateVote(targetPlayer);
        return;
      }

      setPlayerVote(targetPlayer);

      if (mockModal) {
        const newMockVotes = { ...mockVotes };
        newMockVotes[targetPlayer] = (newMockVotes[targetPlayer] || 0) + 1;
        setMockVotes(newMockVotes);
      } else {
        socket.emit('werewolf:player-voted', targetPlayer);
      }
    },
    [mockModal, updateVote, playerVote, mockVotes]
  );

  const resetVoting = useCallback(() => {
    setIsVotingComplete(false);
    setVotingResult(null);
    setPlayerVote('');
    setVotes({});
  }, []);

  return { votes, sendVote, isVotingComplete, votingResult, resetVoting };
}
