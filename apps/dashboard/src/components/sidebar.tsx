import { Button } from '@/components/ui/button';
import { useMockPlayerStore } from '@/store/mock-players';
import { socket } from '@/utils/socket';

type SidebarProps = {
  onAddPlayer: () => void;
  onBatchAddPlayers: () => void;
};

export function Sidebar({ onAddPlayer, onBatchAddPlayers }: SidebarProps) {
  const {
    players,
    activePlayerId,
    setActivePlayer,
    removePlayer,
    connectPlayer,
    disconnectPlayer,
  } = useMockPlayerStore();

  const playersArray = Array.from(players.values());

  const getStatusClassName = (status: string) => {
    if (status === 'in-game') {
      return 'bg-green-100 text-green-800';
    }
    if (status === 'lobby') {
      return 'bg-yellow-100 text-yellow-800';
    }
    return 'bg-gray-100 text-gray-600';
  };

  // Admin controls for testing
  const handleStartGame = () => {
    console.log('🎮 Starting game...');
    socket.emit('admin:start-game');
  };

  const handleNextSegment = () => {
    console.log('⏭️ Advancing to next segment...');
    socket.emit('admin:next-segment');
  };

  const handleSimulateWerewolfVote = () => {
    const alivePlayers = playersArray.filter((p) => p.isConnected);
    if (alivePlayers.length > 0) {
      const target = alivePlayers[0].name; // Just pick first player
      console.log(`🐺 Simulating werewolf vote for ${target}`);
      socket.emit('admin:simulate-werewolf-vote', target);
    }
  };

  const handleMockHunterEvent = () => {
    console.log('🎯 Testing Hunter death audio...');
    socket.emit('admin:mock-hunter-event');
  };

  const handleMockLoverEvent = () => {
    console.log('💕 Testing Lover death audio...');
    socket.emit('admin:mock-lover-event');
  };

  const handleMockLoverSecondHunterEvent = () => {
    console.log('💕🎯 Testing Lover dies, second is Hunter...');
    socket.emit('admin:mock-lover-second-hunter-event');
  };

  const handleMockLoverIsHunterEvent = () => {
    console.log('💕🎯 Testing Lover who IS Hunter dies...');
    socket.emit('admin:mock-lover-is-hunter-event');
  };

  const handleMockDayVoteHunterEvent = () => {
    console.log('🗳️🎯 Testing Village kills Hunter...');
    socket.emit('admin:mock-day-vote-hunter-event');
  };

  const handleMockDayVoteLoverEvent = () => {
    console.log('🗳️💕 Testing Village kills Lover...');
    socket.emit('admin:mock-day-vote-lover-event');
  };

  const handleMockDayVoteLoverIsHunterEvent = () => {
    console.log('🗳️💕🎯 Testing Village kills Lover who IS Hunter...');
    socket.emit('admin:mock-day-vote-lover-is-hunter-event');
  };

  const handleMockDayVoteLoverSecondHunterEvent = () => {
    console.log('🗳️💕🎯 Testing Village kills Lover, second is Hunter...');
    socket.emit('admin:mock-day-vote-lover-second-hunter-event');
  };

  return (
    <div className="flex w-64 flex-col border-r border-gray-200 bg-gray-100">
      <div className="border-b border-gray-200 p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Mock Players
        </h2>
        <Button className="w-full" onClick={onAddPlayer} size="sm">
          + Add Player
        </Button>
        <Button className="mt-2 w-full" onClick={onBatchAddPlayers} size="sm">
          Batch Add Players
        </Button>
      </div>

      {/* Admin Controls */}
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

      {/* Audio Testing Controls */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-600">
          🔊 Audio Testing
        </h3>
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-gray-500">Pre Day Vote</h4>
          <Button
            className="w-full text-xs"
            onClick={handleMockHunterEvent}
            size="sm"
            variant="outline"
          >
            🎯 Werewolf kills Hunter
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockLoverEvent}
            size="sm"
            variant="outline"
          >
            💕 Werewolf kills Lover
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockLoverSecondHunterEvent}
            size="sm"
            variant="outline"
          >
            💕🎯 Lover dies, 2nd is Hunter
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockLoverIsHunterEvent}
            size="sm"
            variant="outline"
          >
            💕🎯 Lover IS Hunter dies
          </Button>

          <h4 className="text-xs font-medium text-gray-500 mt-3">
            Post Day Vote
          </h4>
          <Button
            className="w-full text-xs"
            onClick={handleMockDayVoteHunterEvent}
            size="sm"
            variant="outline"
          >
            🗳️🎯 Village kills Hunter
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockDayVoteLoverEvent}
            size="sm"
            variant="outline"
          >
            🗳️💕 Village kills Lover
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockDayVoteLoverIsHunterEvent}
            size="sm"
            variant="outline"
          >
            🗳️💕🎯 Village kills Lover/Hunter
          </Button>
          <Button
            className="w-full text-xs"
            onClick={handleMockDayVoteLoverSecondHunterEvent}
            size="sm"
            variant="outline"
          >
            🗳️💕🎯 Village kills Lover, 2nd Hunter
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {playersArray.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No players yet. Add one to get started!
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {playersArray.map((player) => (
              // biome-ignore lint/a11y/useSemanticElements: <>
              <div
                className={`cursor-pointer rounded-lg border p-3 transition-colors${
                  activePlayerId === player.id
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                key={player.id}
                onClick={() => setActivePlayer(player.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActivePlayer(player.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">👤</span>
                    <span className="font-medium text-gray-800">
                      {player.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className={`rounded p-1 text-xs${
                        player.isConnected
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-gray-400 hover:bg-gray-50'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (player.isConnected) {
                          disconnectPlayer(player.id);
                        } else {
                          connectPlayer(player.id);
                        }
                      }}
                      title={player.isConnected ? 'Disconnect' : 'Connect'}
                      type="button"
                    >
                      {player.isConnected ? '📶' : '📵'}
                    </button>
                    <button
                      className="rounded p-1 text-xs text-red-500 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        removePlayer(player.id);
                      }}
                      title="Remove player"
                      type="button"
                    >
                      🗑
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div
                    className={`rounded px-2 py-1${getStatusClassName(player.status)}`}
                  >
                    {player.status}
                  </div>
                  {player.playersList.length > 0 && (
                    <div className="text-gray-500">
                      Players: {player.playersList.length}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
