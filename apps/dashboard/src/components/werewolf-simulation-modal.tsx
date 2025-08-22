import type { PlayerListItem } from '@repo/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

type WerewolfSimulationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playersList: PlayerListItem[];
  currentPlayerName: string;
  onSimulateVotes: (targetPlayerName: string) => void;
};

export function WerewolfSimulationModal({
  isOpen,
  onClose,
  playersList,
  currentPlayerName,
  onSimulateVotes,
}: WerewolfSimulationModalProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>('');

  const availableTargets = playersList.filter(
    (player) => player.name !== currentPlayerName
  );

  const handleSubmit = () => {
    if (selectedTarget) {
      onSimulateVotes(selectedTarget);
      setSelectedTarget('');
      onClose();
    }
  };

  const handleClose = () => {
    setSelectedTarget('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-2xl">🐺</span>
          <h2 className="text-xl font-bold text-gray-800">
            Simulate Werewolf Voting
          </h2>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Select a target player to simulate all werewolves voting for them.
          This will send votes from all werewolf players in the game.
        </p>

        <div className="mb-6">
          <h3 className="mb-3 text-sm font-medium text-gray-700">
            Select Target Player:
          </h3>

          {availableTargets.length === 0 ? (
            <div className="py-4 text-center text-gray-500">
              No other players available to target
            </div>
          ) : (
            <div className="space-y-2">
              {availableTargets.map((player) => (
                <button
                  className={`w-full rounded-lg border-2 p-3 text-left transition-colors ${
                    selectedTarget === player.name
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                  key={player.socketId}
                  onClick={() => setSelectedTarget(player.name)}
                  type="button"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">
                      {selectedTarget === player.name ? '🎯' : '👤'}
                    </span>
                    <span className="font-medium text-gray-800">
                      {player.name}
                    </span>
                    {selectedTarget === player.name && (
                      <span className="ml-auto text-xs font-medium text-red-600">
                        Selected Target
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1 bg-red-600 hover:bg-red-700"
            disabled={!selectedTarget}
            onClick={handleSubmit}
          >
            🐺 Simulate All Werewolf Votes
          </Button>
          <Button onClick={handleClose} variant="outline">
            Cancel
          </Button>
        </div>

        {selectedTarget && (
          <div className="mt-3 rounded bg-red-50 p-3">
            <p className="text-sm text-red-700">
              <strong>Target:</strong> {selectedTarget}
            </p>
            <p className="text-xs text-red-600">
              All werewolves in the game will vote for this player
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
