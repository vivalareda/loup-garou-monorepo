import { isGamePlayer } from '@repo/types';
import { useMemo, useState } from 'react';
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

type HunterModalProps = {
  isOpen: boolean;
  onClose: () => void;
  playerId: string;
};

export function HunterModal({ isOpen, onClose, playerId }: HunterModalProps) {
  const { players, killHunterTarget } = useMockPlayerStore();
  const [selectedTarget, setSelectedTarget] = useState('');

  const hunterPlayer = players.get(playerId);
  const targetOptions = useMemo(() => {
    if (!(hunterPlayer?.player && isGamePlayer(hunterPlayer.player))) {
      return [];
    }

    const hunterSid = hunterPlayer.player.sid;

    return Array.from(players.values()).filter(
      (player) =>
        player.player &&
        isGamePlayer(player.player) &&
        player.player.isAlive &&
        player.player.sid !== hunterSid
    );
  }, [hunterPlayer, players]);

  if (!(isOpen && hunterPlayer?.player && isGamePlayer(hunterPlayer.player))) {
    return null;
  }

  const handleClose = () => {
    setSelectedTarget('');
    onClose();
  };

  const handleConfirm = () => {
    if (!selectedTarget) {
      return;
    }
    killHunterTarget(playerId, selectedTarget);
    handleClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Hunter - Choose Target">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Select a player to eliminate before the day vote resumes.
        </p>
        <Select onValueChange={setSelectedTarget} value={selectedTarget}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a target" />
          </SelectTrigger>
          <SelectContent>
            {targetOptions.map((player) => (
              <SelectItem
                key={player.player?.sid}
                value={player.player?.sid || ''}
              >
                {player.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={!selectedTarget}
            onClick={handleConfirm}
          >
            Confirm
          </Button>
          <Button className="flex-1" onClick={handleClose} variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
