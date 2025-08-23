import type { PlayerListItem } from '@repo/types';
import { useWerewolfVotes } from '@/hooks/useWerewolfVotes';

type WerewolfVotingModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playersList: PlayerListItem[];
  currentPlayerName: string;
};

export function WerewolfVotingModal({
  isOpen,
  onClose,
  playersList,
  currentPlayerName,
}: WerewolfVotingModalProps) {
  const {
    votes,
    sendVote,
    isVotingComplete,
    votingResult,
    resetVoting,
    playerVote,
  } = useWerewolfVotes();

  if (!isOpen) {
    return null;
  }

  // Filter out werewolves (for now, we'll assume current player is werewolf and others can be targets)
  const availableTargets = playersList.filter(
    (player) => player.name !== currentPlayerName
  );

  const handleVote = (playerName: string) => {
    sendVote(playerName);
  };

  const handleClose = () => {
    resetVoting();
    onClose();
  };

  const totalVotes = Object.values(votes).reduce(
    (sum, count) => sum + count,
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-red-800">🐺 Werewolf Voting</h2>
          <button
            className="text-xl font-bold text-gray-500 hover:text-gray-700"
            onClick={handleClose}
          >
            ×
          </button>
        </div>

        {isVotingComplete ? (
          <div className="py-4 text-center">
            <h3 className="mb-2 text-lg font-semibold text-green-600">
              ✅ Voting Complete!
            </h3>
            {votingResult ? (
              <p className="text-gray-700">
                Target selected:{' '}
                <span className="font-bold text-red-600">{votingResult}</span>
              </p>
            ) : (
              <p className="text-gray-700">
                <span className="font-bold text-yellow-600">Tie!</span> No
                consensus reached.
              </p>
            )}
            <button
              className="mt-4 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
              onClick={handleClose}
              type="button"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <p className="mb-4 text-gray-600">
              Choose a player to eliminate. Current votes: {totalVotes}
            </p>

            {playerVote && (
              <div className="mb-4 rounded border border-yellow-300 bg-yellow-100 p-2">
                <p className="text-sm text-yellow-800">
                  Your current vote:{' '}
                  <span className="font-bold">{playerVote}</span>
                </p>
                <p className="text-xs text-yellow-600">
                  Click another player to change your vote
                </p>
              </div>
            )}

            <div className="mb-4 space-y-2">
              {availableTargets.map((player) => {
                const voteCount = votes[player.name] || 0;
                const isSelected = playerVote === player.name;

                return (
                  <button
                    className={`w-full rounded border p-3 text-left transition-colors${
                      isSelected
                        ? 'bg-red-100 border-red-300 border-2'
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    key={player.socketId}
                    onClick={() => handleVote(player.name)}
                    type="button"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-2">
                        {voteCount > 0 && (
                          <span className="rounded-full bg-red-500 px-2 py-1 text-xs text-white">
                            {voteCount} vote{voteCount !== 1 ? 's' : ''}
                          </span>
                        )}
                        {isSelected && (
                          <span className="font-bold text-red-600">✓</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {Object.keys(votes).length > 0 && (
              <div className="border-t pt-4">
                <h4 className="mb-2 font-semibold text-gray-700">
                  Current Vote Tally:
                </h4>
                <div className="space-y-1 text-sm">
                  {Object.entries(votes)
                    .sort(([, a], [, b]) => b - a)
                    .map(([playerName, count]) => (
                      <div className="flex justify-between" key={playerName}>
                        <span>{playerName}</span>
                        <span className="font-medium">
                          {count} vote{count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
