import type { PlayerIdentity } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import type { MockPlayer } from '@/store/mock-players';

type CupidSelectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  player: MockPlayer;
  playersList: PlayerIdentity[];
  selectedLovers: string[];
  onToggleSelection: (playerId: string, loverName: string) => void;
  onConfirm: (playerId: string) => void;
};

export function CupidSelectionModal({
  isOpen,
  onClose,
  player,
  playersList,
  selectedLovers,
  onToggleSelection,
  onConfirm,
}: CupidSelectionModalProps) {
  if (!isOpen) {
    return null;
  }

  const playerSid = player.player?.sid ?? player.socket.id;
  const availableTargets = playersList.filter((p) => p.sid !== playerSid);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="💘 Cupid - Select Two Lovers"
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose two players to fall in love. Selected: {selectedLovers.length}
          /2
        </p>

        <div className="space-y-2">
          {availableTargets.length === 0 ? (
            <div className="rounded bg-gray-100 p-3 text-sm text-gray-600">
              No available players to select.
            </div>
          ) : (
            availableTargets.map((target) => {
              const isSelected = selectedLovers.includes(target.name);
              return (
                <button
                  className={`w-full rounded border p-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-pink-100 border-pink-300 border-2'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  key={target.sid}
                  onClick={() => onToggleSelection(player.id, target.name)}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">
                      {target.name}
                    </span>
                    <span className="text-sm text-pink-600">
                      {isSelected ? 'Selected' : 'Select'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            className="bg-pink-600 hover:bg-pink-700"
            disabled={selectedLovers.length !== 2}
            onClick={() => onConfirm(player.id)}
          >
            Confirm Lovers
          </Button>
        </div>
      </div>
    </Modal>
  );
}
