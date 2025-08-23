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
    'socket-id-1': 1,
    'socket-id-2': 2,
    'socket-id-3': 3,
    'socket-id-4': 3,
    'socket-id-5': 5,
  });

  useEffect(() => {
    if (mockModal) {
      setVotes(mockVotes);
      return;
    }
    socket.on('werewolf:current-votes', (currentVotes: WerewolvesVoteState) => {
      setVotes(currentVotes);
    });

    socket.on('werewolf:voting-complete', () => {
      setIsVotingComplete(true);
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
    (targetPlayerSid: string) => {
      if (playerVote) {
        updateVote(targetPlayerSid);
        return;
      }

      setPlayerVote(targetPlayerSid);

      if (mockModal) {
        const newMockVotes = { ...mockVotes };
        newMockVotes[targetPlayerSid] =
          (newMockVotes[targetPlayerSid] || 0) + 1;
        setMockVotes(newMockVotes);
      } else {
        socket.emit('werewolf:player-voted', targetPlayerSid);
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
