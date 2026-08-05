import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useMockPlayerStore } from '@/store/mock-players';

type HunterVoteModalProps = {
  playerId: string;
};

export const HunterVoteModal = ({ playerId }: HunterVoteModalProps) => {
  const { players, killPlayerAsHunter, closeHunterModal } =
    useMockPlayerStore();
  const player = players.get(playerId);

  if (!player?.showHunterModal) {
    return null;
  }

  // Get all alive players except current player (hunter) for revenge kill
  const alivePlayers = Array.from(players.values()).filter(
    (p) => p.player?.type === 'game' && p.player.isAlive && p.id !== playerId
  );

  const handleKillSubmit = (targetPlayer: {
    id: string;
    name: string;
    socketId: string;
  }) => {
    killPlayerAsHunter(playerId, targetPlayer.socketId);
  };

  return (
    <Modal isOpen onClose={() => closeHunterModal(playerId)}>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <h2 className="text-xl font-bold">
            Hunter's Revenge - {player.name}
          </h2>
        </div>
        <p className="text-gray-600">
          You have been killed! As the Hunter, you may take one player with you
          to the grave.
        </p>
        <p className="text-sm text-orange-600 font-medium">
          Choose your revenge target:
        </p>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {alivePlayers.length === 0 ? (
            <p className="text-gray-500">No other players to target</p>
          ) : (
            alivePlayers.map((p) => (
              <Button
                className="w-full justify-start bg-orange-600 hover:bg-orange-700"
                key={p.id}
                onClick={() =>
                  handleKillSubmit({
                    id: p.id,
                    name: p.name,
                    socketId: p.player?.socketId || '',
                  })
                }
                variant="outline"
              >
                🎯 Shoot {p.name}
              </Button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
