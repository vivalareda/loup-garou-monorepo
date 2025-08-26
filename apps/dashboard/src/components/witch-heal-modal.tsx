import type { PlayerListItem } from '@repo/types';

type WitchHealModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playersList: PlayerListItem[];
  werewolfVictimId: string | null;
  onHeal: () => void;
  onSkip: () => void;
};

export function WitchHealModal({
  isOpen,
  onClose,
  playersList,
  werewolfVictimId,
  onHeal,
  onSkip,
}: WitchHealModalProps) {
  if (!isOpen) {
    return null;
  }

  const werewolfVictim = playersList.find(
    (player) => player.socketId === werewolfVictimId
  );

  const handleClose = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-green-800">🧙‍♀️ Witch - Heal</h2>
          <button
            className="text-xl font-bold text-gray-500 hover:text-gray-700"
            onClick={handleClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="mb-6 text-center">
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Do you want to save the victim?
          </h3>

          {werewolfVictim ? (
            <div className="mb-4 rounded border border-red-300 bg-red-50 p-3">
              <p className="text-red-800">
                <span className="font-bold">{werewolfVictim.name}</span> was
                targeted by the werewolves
              </p>
            </div>
          ) : (
            <div className="mb-4 rounded border border-gray-300 bg-gray-50 p-3">
              <p className="text-gray-600">No werewolf victim found</p>
            </div>
          )}

          <p className="mb-6 text-sm text-gray-600">
            You can use your healing potion to save them, or skip to preserve it
            for later.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            className="flex-1 rounded bg-green-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-600"
            disabled={!werewolfVictim}
            onClick={onHeal}
            type="button"
          >
            🧪 Heal Victim
          </button>
          <button
            className="flex-1 rounded bg-gray-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-600"
            onClick={onSkip}
            type="button"
          >
            Skip
          </button>
        </div>

        <p className="mt-3 text-xs text-center text-gray-500">
          You can only use your healing potion once per game
        </p>
      </div>
    </div>
  );
}
