import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { AddPlayerModal } from '@/components/add-player-modal';
import { BatchAddPlayersModal } from '@/components/batch-add-players-modal';
import { PlayerView } from '@/components/player-view';
import { Sidebar } from '@/components/sidebar';

export default function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);

  useHotkeys(
    ['cmd+u', 'cmd+shift+u'],
    (event) => {
      event.preventDefault();
      setIsBatchAddModalOpen(true);
    },
    {
      preventDefault: true,
      enableOnFormTags: true,
    }
  );

  return (
    <div className="flex h-screen w-full bg-gray-100">
      <Sidebar
        onAddPlayer={() => setIsAddModalOpen(true)}
        onBatchAddPlayers={() => setIsBatchAddModalOpen(true)}
      />
      <PlayerView />
      <AddPlayerModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />
      <BatchAddPlayersModal
        isOpen={isBatchAddModalOpen}
        onClose={() => setIsBatchAddModalOpen(false)}
      />
    </div>
  );
}
