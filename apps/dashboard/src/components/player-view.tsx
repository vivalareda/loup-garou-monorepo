import { isGamePlayer } from '@repo/types';
import { Button } from '@/components/ui/button';
import { useMockPlayerStore } from '@/store/mock-players';

function getStatusClassName(
  status: 'waiting' | 'in-game' | 'disconnected'
): string {
  if (status === 'in-game') {
    return 'bg-green-100 text-green-800';
  }
  if (status === 'waiting') {
    return 'bg-yellow-100 text-yellow-800';
  }
  return 'bg-gray-100 text-gray-600';
}

export function PlayerView() {
  const {
    players,
    activePlayerId,
    connectPlayer,
    disconnectPlayer,
    sendLoverClosedAlert,
    toggleLoverSelection,
    sendLoverSelection,
  } = useMockPlayerStore();

  const activePlayer = activePlayerId ? players.get(activePlayerId) : null;

  if (!activePlayer) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50">
        <div className="text-center text-gray-500">
          <div className="mb-4 text-6xl">🎮</div>
          <h2 className="mb-2 text-xl font-semibold">No Player Selected</h2>
          <p>Select a player from the sidebar to view their state</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                {activePlayer.name}
              </h1>
              <div className="mt-1 flex items-center gap-2">
                <span
                  className={`rounded px-2 py-1 text-xs font-medium${getStatusClassName(activePlayer.status)}`}
                >
                  {activePlayer.status}
                </span>
                <span
                  className={`rounded px-2 py-1 text-xs font-medium${
                    activePlayer.isConnected
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {activePlayer.isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {activePlayer.isLover && (
                  <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                    💕 Lover
                  </span>
                )}
                {activePlayer.isCupid && (
                  <span className="rounded bg-pink-100 px-2 py-1 text-xs font-medium text-pink-800">
                    💘 Cupid
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {activePlayer.isConnected ? (
                <Button
                  onClick={() => disconnectPlayer(activePlayer.id)}
                  variant="outline"
                >
                  Disconnect
                </Button>
              ) : (
                <Button onClick={() => connectPlayer(activePlayer.id)}>
                  Connect
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Player Data */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Player Data
            </h2>
            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium text-gray-600">Name</div>
                <div className="text-gray-800">{activePlayer.name}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">
                  Socket ID
                </div>
                <div className="font-mono text-sm text-gray-800">
                  {activePlayer.socket.id || 'Not connected'}
                </div>
              </div>
              {activePlayer.player && (
                <>
                  <div>
                    <div className="text-sm font-medium text-gray-600">
                      Player Object
                    </div>
                    <pre className="mt-1 rounded bg-gray-50 p-2 text-xs">
                      {JSON.stringify(activePlayer.player, null, 2)}
                    </pre>
                  </div>
                  {activePlayer.player && isGamePlayer(activePlayer.player) && (
                    <div>
                      <div className="text-sm font-medium text-gray-600">
                        Role
                      </div>
                      <div className="text-lg font-bold text-blue-600">
                        {activePlayer.player.role}
                      </div>
                    </div>
                  )}
                </>
              )}
              {activePlayer.isLover && (
                <div>
                  <div className="text-sm font-medium text-gray-600">
                    Lover Status
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💕</span>
                    <span className="font-medium text-red-600">
                      In love with {activePlayer.loverName}
                    </span>
                  </div>
                  {activePlayer.canCloseLoverAlert && (
                    <Button
                      className="mt-2"
                      onClick={() => sendLoverClosedAlert(activePlayer.id)}
                      size="sm"
                    >
                      Close Lover Alert
                    </Button>
                  )}
                </div>
              )}
              {activePlayer.isCupid && activePlayer.canSelectLovers && (
                <div>
                  <div className="text-sm font-medium text-gray-600">
                    Cupid - Select Two Lovers
                  </div>
                  <div className="mt-2 space-y-2">
                    {activePlayer.playersList
                      .filter(player => player.name !== activePlayer.name)
                      .map((player) => (
                      <div
                        key={player.sid}
                        className={`flex items-center gap-2 rounded p-2 cursor-pointer transition-colors ${
                          activePlayer.selectedLovers.includes(player.name)
                            ? 'bg-pink-100 border-2 border-pink-300'
                            : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                        }`}
                        onClick={() => toggleLoverSelection(activePlayer.id, player.name)}
                      >
                        <span className="text-gray-600">
                          {activePlayer.selectedLovers.includes(player.name) ? '💘' : '👤'}
                        </span>
                        <span className="text-gray-800">{player.name}</span>
                        {activePlayer.selectedLovers.includes(player.name) && (
                          <span className="text-xs text-pink-600 font-medium">Selected</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      onClick={() => sendLoverSelection(activePlayer.id)}
                      disabled={activePlayer.selectedLovers.length !== 2}
                      className="bg-pink-600 hover:bg-pink-700"
                    >
                      Confirm Lover Selection ({activePlayer.selectedLovers.length}/2)
                    </Button>
                    {activePlayer.selectedLovers.length > 0 && (
                      <span className="text-sm text-gray-600">
                        Selected: {activePlayer.selectedLovers.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Players List */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-800">
              Players in Waiting Room ({activePlayer.playersList.length})
            </h2>
            {activePlayer.playersList.length === 0 ? (
              <div className="py-4 text-center text-gray-500">
                No players in waiting room
              </div>
            ) : (
              <div className="space-y-2">
                {activePlayer.playersList.map((player) => (
                  <div
                    className="flex items-center gap-2 rounded bg-gray-50 p-2"
                    key={player.sid}
                  >
                    <span className="text-gray-600">👤</span>
                    <span className="text-gray-800">{player.name}</span>
                    {player.name === activePlayer.name && (
                      <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                        You
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Socket Events Log */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Socket Events
          </h2>
          <div className="py-4 text-center text-gray-500">
            Socket events will be logged here in future iterations
          </div>
        </div>
      </div>
    </div>
  );
}
