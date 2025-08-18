import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useMockPlayerStore } from '@/store/mock-players';

type AddPlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function AddPlayerModal({ isOpen, onClose }: AddPlayerModalProps) {
  const [playerName, setPlayerName] = useState('');
  const addPlayer = useMockPlayerStore((state) => state.addPlayer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      addPlayer(playerName.trim());
      setPlayerName('');
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Mock Player">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="playerName"
          >
            Player Name
          </label>
          <Input
            autoFocus
            id="playerName"
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter player name..."
            type="text"
            value={playerName}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!playerName.trim()} type="submit">
            Add Player
          </Button>
        </div>
      </form>
    </Modal>
  );
}
