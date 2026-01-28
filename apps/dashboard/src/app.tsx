import type { SegmentType } from '@repo/types';
import { useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Link, Route, Routes } from 'react-router-dom';
import { AddPlayerModal } from '@/components/add-player-modal';
import { BatchAddPlayersModal } from '@/components/batch-add-players-modal';
import { ModernDashboard } from '@/components/modern-dashboard';
import { SelectSegmentModal } from '@/components/select-segment-modal';
import { ServerDashboard } from '@/components/server-dashboard';
import { socket } from '@/utils/socket';
import { useMockPlayerStore } from './store/mock-players';

const AUTO_PLAYER_COUNT = 6;

export default function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBatchAddModalOpen, setIsBatchAddModalOpen] = useState(false);
  const [isMockSegmentModalOpen, setIsMockSegmentModalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mockSegment, setMockSegment] = useState<SegmentType | undefined>(
    undefined
  );
  const addPlayer = useMockPlayerStore((state) => state.addPlayer);

  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const handleHotkeyPress = async () => {
    for (let i = 1; i <= AUTO_PLAYER_COUNT; i++) {
      addPlayer(`test-player-${i}`);
    }
    setMockSegment('WITCH_HEAL');
    await sleep(1000);
    socket.emit('lobby:start-mock', 'WITCH_HEAL');
  };

  useHotkeys(
    ['shift+h'],
    () => {
      handleHotkeyPress();
    },
    { preventDefault: true, enableOnFormTags: true }
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
              mockSegment={mockSegment}
              onAddPlayer={() => setIsAddModalOpen(true)}
              onBatchAddPlayers={() => setIsBatchAddModalOpen(true)}
              onModernSegmentClick={() => setIsMockSegmentModalOpen(true)}
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
            <SelectSegmentModal
              isOpen={isMockSegmentModalOpen}
              mockSegment={mockSegment}
              onClose={() => setIsMockSegmentModalOpen(false)}
              setMockSegment={setMockSegment}
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
