import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useMockPlayerStore } from '@/store/mock-players';

type BatchAddPlayersModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function BatchAddPlayersModal({ isOpen, onClose }: BatchAddPlayersModalProps) {
  const [playerCount, setPlayerCount] = useState('');
  const [namePrefix, setNamePrefix] = useState('');
  const addPlayer = useMockPlayerStore((state) => state.addPlayer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const count = Number.parseInt(playerCount, 10);
    
    if (count > 0 && count <= 20) { // Reasonable limit
      const prefix = namePrefix.trim() || 'player';
      
      for (let i = 1; i <= count; i++) {
        addPlayer(`${prefix}${i}`);
      }
      
      setPlayerCount('');
      setNamePrefix('');
      onClose();
    }
  };

  const count = Number.parseInt(playerCount, 10);
  const isValidCount = count > 0 && count <= 20;
  const prefix = namePrefix.trim() || 'player';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Batch Add Players">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="playerCount"
          >
            Number of Players (1-20)
          </label>
          <Input
            autoFocus
            id="playerCount"
            min="1"
            max="20"
            onChange={(e) => setPlayerCount(e.target.value)}
            placeholder="Enter number of players..."
            type="number"
            value={playerCount}
          />
        </div>
        
        <div>
          <label
            className="block text-sm font-medium text-gray-700 mb-1"
            htmlFor="namePrefix"
          >
            Name Prefix (optional)
          </label>
          <Input
            id="namePrefix"
            onChange={(e) => setNamePrefix(e.target.value)}
            placeholder="player (default)"
            type="text"
            value={namePrefix}
          />
          <p className="text-xs text-gray-500 mt-1">
            Leave empty to use "player" as prefix
          </p>
        </div>

        {isValidCount && (
          <div className="bg-gray-50 p-3 rounded border">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: Math.min(count, 10) }, (_, i) => (
                <span
                  key={i}
                  className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
                >
                  {prefix}{i + 1}
                </span>
              ))}
              {count > 10 && (
                <span className="text-gray-500 text-xs px-2 py-1">
                  ... and {count - 10} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button disabled={!isValidCount} type="submit">
            Add {isValidCount ? count : 0} Player{count !== 1 ? 's' : ''}
          </Button>
        </div>
      </form>
    </Modal>
  );
}