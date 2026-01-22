import { Button } from '@/components/ui/button';
import { socket } from '@/utils/socket';

export function AdminControls() {
  const handleStartGame = () => {
    console.log('🎮 Starting game...');
    socket.emit('admin:start-game');
  };

  const handleNextSegment = () => {
    console.log('⏭️ Advancing to next segment...');
    socket.emit('admin:next-segment');
  };

  const handleSimulateWerewolfVote = () => {
    console.log('🐺 Simulating werewolf vote...');
    socket.emit('admin:simulate-werewolf-vote', '');
  };

  return (
    <div className="border-b border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-600">
        🎮 Game Controls
      </h3>
      <div className="space-y-2">
        <Button
          className="w-full text-xs"
          onClick={handleStartGame}
          size="sm"
          variant="outline"
        >
          🚀 Start Game
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleNextSegment}
          size="sm"
          variant="outline"
        >
          ⏭️ Next Segment
        </Button>
        <Button
          className="w-full text-xs"
          onClick={handleSimulateWerewolfVote}
          size="sm"
          variant="outline"
        >
          🐺 Simulate Wolf Vote
        </Button>
      </div>
    </div>
  );
}
