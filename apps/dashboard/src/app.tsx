import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { AddPlayerModal } from '@/components/add-player-modal';
import { BatchAddPlayersModal } from '@/components/batch-add-players-modal';
import { PlayerView } from '@/components/player-view';
import { Sidebar } from '@/components/sidebar';

export default function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);

  // Add debugging and prevent default browser behavior
  useHotkeys(
    'cmd+u',
    (event) => {
      console.log('Hotkey triggered: cmd+u');
      event.preventDefault();
      setIsBatchAddModalOpen(true);
    },
    {
      preventDefault: true,
      enableOnFormTags: true, // Enable even when focused on form elements
    }
  );

  // Alternative hotkey that's less likely to conflict
  useHotkeys(
    'cmd+shift+u',
    () => {
      console.log('Alternative hotkey triggered: cmd+shift+u');
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
