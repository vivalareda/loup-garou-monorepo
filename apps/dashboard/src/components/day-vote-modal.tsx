import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useMockPlayerStore } from '@/store/mock-players';

type DayVoteModalProps = {
  playerId: string;
};

export const DayVoteModal = ({ playerId }: DayVoteModalProps) => {
  const { players, voteDayPlayer, closeDayVoteModal } = useMockPlayerStore();
  const player = players.get(playerId);

  if (!player?.showDayVoteModal) {
    return null;
  }

  // Get all alive players except current player for voting
  const alivePlayers = Array.from(players.values()).filter(
    (p) => p.player?.type === 'game' && p.player.isAlive && p.id !== playerId
  );

  const handleVoteSubmit = (targetPlayer: {
    id: string;
    name: string;
    socketId: string;
  }) => {
    voteDayPlayer(playerId, targetPlayer.socketId);
  };

  return (
    <Modal isOpen onClose={() => closeDayVoteModal(playerId)}>
      <div className="space-y-4">
        <h2 className="text-xl font-bold">Day Vote - {player.name}</h2>
        <p className="text-gray-600">Vote to eliminate a player:</p>

        <div className="space-y-2">
          {alivePlayers.length === 0 ? (
            <p className="text-gray-500">No other players to vote for</p>
          ) : (
            alivePlayers.map((p) => (
              <Button
                className="w-full justify-start"
                key={p.id}
                onClick={() =>
                  handleVoteSubmit({
                    id: p.id,
                    name: p.name,
                    socketId: p.player?.socketId || '',
                  })
                }
                variant="outline"
              >
                Vote {p.name}
              </Button>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
};
