import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { AddPlayerModal } from '@/components/add-player-modal';
import { BatchAddPlayersModal } from '@/components/batch-add-players-modal';
import { ModernDashboard } from '@/components/modern-dashboard';

export default function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

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
    <div
      className={`flex h-screen w-full transition-colors ${isDarkMode ? 'dark bg-gray-950' : 'bg-gray-100'}`}
    >
      <ModernDashboard
        isDarkMode={isDarkMode}
        onAddPlayer={() => setIsAddModalOpen(true)}
        onBatchAddPlayers={() => setIsBatchAddModalOpen(true)}
        setIsDarkMode={setIsDarkMode}
      />
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
