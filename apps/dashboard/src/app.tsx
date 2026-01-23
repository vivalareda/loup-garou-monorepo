import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Link, Route, Routes } from 'react-router-dom';
import { AddPlayerModal } from '@/components/add-player-modal';
import { BatchAddPlayersModal } from '@/components/batch-add-players-modal';
import { ModernDashboard } from '@/components/modern-dashboard';
import { ServerDashboard } from '@/components/server-dashboard';

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
    <Routes>
      <Route
        element={
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
        }
        path="/"
      />
      <Route
        element={
          <Link
            className="fixed top-4 left-4 z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            to="/"
          >
            ← Back to Dashboard
          </Link>
        }
        path="/server/*"
      />
      <Route element={<ServerDashboard />} path="/server" />
    </Routes>
  );
}
