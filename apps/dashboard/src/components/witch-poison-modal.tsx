import type { PlayerListItem } from '@repo/types';

type WitchPoisonModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playersList: PlayerListItem[];
  currentPlayerName: string;
  onPoison: (targetPlayerId: string) => void;
  onSkip: () => void;
};

export function WitchPoisonModal({
  isOpen,
  onClose,
  playersList,
  currentPlayerName,
  onPoison,
  onSkip,
}: WitchPoisonModalProps) {
  if (!isOpen) {
    return null;
  }

  // Filter out the witch themselves
  const availableTargets = playersList.filter(
    (player) => player.name !== currentPlayerName
  );

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-purple-800">
            🧙‍♀️ Witch - Poison
          </h2>
          <button
            className="text-xl font-bold text-gray-500 hover:text-gray-700"
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mb-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Choose someone to poison
          </h3>

          <p className="mb-4 text-sm text-gray-600">
            Select a player to eliminate with your poison, or skip to preserve
            it for later.
          </p>
        </div>

        <div className="mb-4 space-y-2">
          {availableTargets.map((player) => (
            <button
              className="w-full rounded border border-gray-200 bg-gray-50 p-3 text-left transition-colors hover:bg-purple-50 hover:border-purple-300"
              key={player.socketId}
              onClick={() => onPoison(player.socketId)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{player.name}</span>
                <span className="text-purple-600">☠️</span>
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 rounded bg-gray-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-600"
            onClick={onSkip}
            type="button"
          >
            Skip Poison
          </button>
        </div>

        <p className="mt-3 text-xs text-center text-gray-500">
          You can only use your poison once per game
        </p>
      </div>
    </div>
  );
}
