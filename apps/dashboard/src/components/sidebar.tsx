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
    if (status === 'waiting') {
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

  const handleMockHunterRevengeKillsLover = () => {
    console.log('🎯💕 Testing Hunter revenge kills Lover...');
    socket.emit('admin:mock-hunter-revenge-kills-lover');
  };

  return (
    <div className="flex h-screen w-80 flex-col border-r border-gray-200 bg-gray-100">
      <div className="border-b border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-800">
          Mock Players
        </h2>
        <div className="space-y-2">
          <Button className="w-full" onClick={onAddPlayer} size="sm">
            + Add Player
          </Button>
          <Button className="w-full" onClick={onBatchAddPlayers} size="sm">
            Batch Add Players
          </Button>
        </div>
      </div>

      {/* Admin Controls */}
      <div className="border-b border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">
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

      {/* Audio Testing Controls - Collapsible */}
      <details className="border-b border-gray-200 bg-white">
        <summary className="cursor-pointer p-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          🔊 Audio Testing
        </summary>
        <div className="px-4 pb-4 space-y-2">
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
          <Button
            className="w-full text-xs"
            onClick={handleMockHunterRevengeKillsLover}
            size="sm"
            variant="outline"
          >
            🎯💕 Hunter Revenge → Lover
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
      </details>

      <div className="flex-1 overflow-y-auto bg-gray-100">
        {playersArray.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No players yet. Add one to get started!
          </div>
        ) : (
          <div className="space-y-2 p-3">
            {playersArray.map((player) => (
              // biome-ignore lint/a11y/useSemanticElements: <>
              <div
                className={`cursor-pointer rounded-lg border p-3 transition-all${
                  activePlayerId === player.id
                    ? 'bg-blue-50 border-blue-300 shadow-sm'
                    : 'bg-white border-gray-200 hover:bg-gray-50 hover:shadow-sm'
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
                    <span className="text-lg">👤</span>
                    <span className="font-medium text-gray-800 text-sm">
                      {player.name}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className={`rounded p-1.5 text-sm transition-colors${
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
                      className="rounded p-1.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
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

                <div className="space-y-1">
                  <div
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getStatusClassName(player.status)}`}
                  >
                    {player.status}
                  </div>
                  {player.playersList.length > 0 && (
                    <div className="text-xs text-gray-500">
                      {player.playersList.length} player{player.playersList.length !== 1 ? 's' : ''} in room
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
