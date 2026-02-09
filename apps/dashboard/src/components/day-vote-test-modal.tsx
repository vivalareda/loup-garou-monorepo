import type { WerewolvesVoteState } from '@repo/types';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMockPlayerStore } from '@/store/mock-players';

type DayVoteTestModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function DayVoteTestModal({ isOpen, onClose }: DayVoteTestModalProps) {
  const { players } = useMockPlayerStore();
  const [votes, setVotes] = useState<WerewolvesVoteState>({});
  const [playerVotes, setPlayerVotes] = useState<Record<string, string>>({});
  const [hasVoted, setHasVoted] = useState(false);

  // Get all alive players
  const alivePlayers = Array.from(players.values()).filter(
    (p) =>
      p.player && p.player.type === 'game' && p.player.isAlive && p.isConnected
  );

  // Get all potential vote targets (alive players)
  const voteTargets = alivePlayers;

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Listen for vote updates from all player sockets
    const unsubscribeFns: (() => void)[] = [];

    alivePlayers.forEach((player) => {
      if (!player.socket) return;

      const handleVotesUpdate = (currentVotes: WerewolvesVoteState) => {
        setVotes(currentVotes);
      };

      player.socket.on('day:current-votes', handleVotesUpdate);

      unsubscribeFns.push(() => {
        player.socket.off('day:current-votes', handleVotesUpdate);
      });
    });

    return () => {
      unsubscribeFns.forEach((fn) => fn());
    };
  }, [isOpen, alivePlayers]);

  const handleVoteChange = (voterSocketId: string, targetSocketId: string) => {
    setPlayerVotes((prev) => ({
      ...prev,
      [voterSocketId]: targetSocketId,
    }));
  };

  const handleSubmitVotes = () => {
    // Emit vote for each player that has selected a target
    Object.entries(playerVotes).forEach(([voterSocketId, targetSocketId]) => {
      const voter = alivePlayers.find((p) => p.player?.sid === voterSocketId);
      if (voter?.socket) {
        voter.socket.emit('day:player-voted', targetSocketId);
      }
    });

    setHasVoted(true);
  };

  const handleClose = () => {
    setVotes({});
    setPlayerVotes({});
    setHasVoted(false);
    onClose();
  };

  const totalVotesCast = Object.values(votes).reduce(
    (sum, count) => sum + count,
    0
  );

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="🗳️ Day Vote Test - Cast Votes"
    >
      <div className="space-y-4">
        <p className="text-gray-600">
          Configure votes for each alive player. Total votes cast:{' '}
          {totalVotesCast}
        </p>

        {alivePlayers.length === 0 ? (
          <p className="text-gray-500 italic">
            No alive players available to vote
          </p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {alivePlayers.map((player) => (
              <div
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                key={player.player?.sid}
              >
                <span className="font-medium text-gray-900">{player.name}</span>
                <Select
                  disabled={hasVoted}
                  onValueChange={(value) =>
                    handleVoteChange(player.player?.sid || '', value)
                  }
                  value={playerVotes[player.player?.sid || ''] || ''}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select target..." />
                  </SelectTrigger>
                  <SelectContent>
                    {voteTargets.map((target) => (
                      <SelectItem
                        key={target.player?.sid}
                        value={target.player?.sid || ''}
                      >
                        Vote {target.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        )}

        {/* Vote Tally Display */}
        {Object.keys(votes).length > 0 && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 mb-2">
              Current Vote Tally:
            </h4>
            <div className="space-y-1 text-sm">
              {Object.entries(votes)
                .sort(([, a], [, b]) => b - a)
                .map(([playerName, count]) => (
                  <div
                    className="flex justify-between items-center py-1"
                    key={playerName}
                  >
                    <span className="text-gray-700">{playerName}</span>
                    <span className="font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {count} vote{count !== 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {hasVoted && (
          <div className="rounded border border-green-300 bg-green-100 p-3">
            <p className="text-sm text-green-800 font-medium">
              Votes submitted successfully!
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-4">
          <Button
            className="flex-1"
            disabled={
              hasVoted ||
              alivePlayers.length === 0 ||
              Object.keys(playerVotes).length === 0
            }
            onClick={handleSubmitVotes}
            variant="default"
          >
            Submit Votes
          </Button>
          <Button className="flex-1" onClick={handleClose} variant="outline">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
