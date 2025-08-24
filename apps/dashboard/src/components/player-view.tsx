import { isGamePlayer } from '@repo/types';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useMockPlayerStore } from '@/store/mock-players';
import { WerewolfSimulationModal } from './werewolf-simulation-modal';
import { WerewolfVotingModal } from './werewolf-voting-modal';
import { WitchHealModal } from './witch-heal-modal';
import { WitchPoisonModal } from './witch-poison-modal';

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
  const [isWerewolfVotingOpen, setIsWerewolfVotingOpen] = useState(false);
  const [isWerewolfSimulationOpen, setIsWerewolfSimulationOpen] =
    useState(false);

  const {
    players,
    activePlayerId,
    connectPlayer,
    disconnectPlayer,
    sendLoverClosedAlert,
    toggleLoverSelection,
    sendLoverSelection,
    assignWerewolfRole,
    assignWitchRole,
    simulateAllWerewolfVotes,
    // Witch actions from store
    healPlayer,
    skipHeal,
    poisonPlayer,
    skipPoison,
    closeHealModal,
    closePoisonModal,
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
                      {/* Test button for werewolf role */}
                      {activePlayer.player.role !== 'WEREWOLF' && (
                        <Button
                          className="mt-2 bg-red-600 text-xs hover:bg-red-700"
                          onClick={() => assignWerewolfRole(activePlayer.id)}
                          size="sm"
                        >
                          🧪 Test: Assign Werewolf Role
                        </Button>
                      )}
                      {/* Test button for witch role */}
                      {activePlayer.player.role !== 'WITCH' && (
                        <Button
                          className="ml-2 mt-2 bg-purple-600 text-xs hover:bg-purple-700"
                          onClick={() => assignWitchRole(activePlayer.id)}
                          size="sm"
                        >
                          🧪 Test: Assign Witch Role
                        </Button>
                      )}
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
                      .filter((player) => player.name !== activePlayer.name)
                      .map((player) => (
                        <div
                          className={`flex cursor-pointer items-center gap-2 rounded p-2 transition-colors${
                            activePlayer.selectedLovers.includes(player.name)
                              ? 'bg-pink-100 border-2 border-pink-300'
                              : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                          }`}
                          key={player.socketId}
                          onClick={() =>
                            toggleLoverSelection(activePlayer.id, player.name)
                          }
                        >
                          <span className="text-gray-600">
                            {activePlayer.selectedLovers.includes(player.name)
                              ? '💘'
                              : '👤'}
                          </span>
                          <span className="text-gray-800">{player.name}</span>
                          {activePlayer.selectedLovers.includes(
                            player.name
                          ) && (
                            <span className="text-xs font-medium text-pink-600">
                              Selected
                            </span>
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button
                      className="bg-pink-600 hover:bg-pink-700"
                      disabled={activePlayer.selectedLovers.length !== 2}
                      onClick={() => sendLoverSelection(activePlayer.id)}
                    >
                      Confirm Lover Selection (
                      {activePlayer.selectedLovers.length}/2)
                    </Button>
                    {activePlayer.selectedLovers.length > 0 && (
                      <span className="text-sm text-gray-600">
                        Selected: {activePlayer.selectedLovers.join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Werewolf Voting Section */}
              {activePlayer.status === 'in-game' &&
                activePlayer.player &&
                isGamePlayer(activePlayer.player) &&
                activePlayer.player.role === 'WEREWOLF' && (
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-red-800">
                      🐺 Werewolf Actions
                    </h3>
                    <p className="mb-3 text-sm text-gray-600">
                      Vote to eliminate a villager during the night phase.
                    </p>
                    <Button
                      className="bg-red-600 hover:bg-red-700"
                      onClick={() => setIsWerewolfVotingOpen(true)}
                    >
                      Open Werewolf Voting
                    </Button>
                  </div>
                )}

              {/* Witch Actions Section */}
              {activePlayer.status === 'in-game' &&
                activePlayer.player &&
                isGamePlayer(activePlayer.player) &&
                activePlayer.player.role === 'WITCH' && (
                  <div>
                    <h3 className="mb-3 text-lg font-semibold text-purple-800">
                      🧙 Witch Actions
                    </h3>
                    <p className="mb-3 text-sm text-gray-600">
                      Use your potions to heal or poison players during the
                      night phase.
                    </p>
                    <div className="space-y-2">
                      <div className="rounded bg-purple-50 p-3">
                        <p className="text-sm text-purple-800">
                          Witch modals will appear automatically when the server
                          prompts you.
                        </p>
                        <p className="mt-1 text-xs text-purple-600">
                          Heal: Save werewolf victim • Poison: Eliminate any
                          player
                        </p>
                      </div>
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
                    key={player.socketId}
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

        {/* Werewolf Simulation Section */}
        <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            🧪 Test Simulation
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-700">
                Werewolf Voting Simulation
              </h3>
              <p className="mb-3 text-xs text-gray-600">
                Simulate all werewolves in the game voting for a single target
                player. This will send votes from every player with the WEREWOLF
                role.
              </p>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={() => setIsWerewolfSimulationOpen(true)}
                size="sm"
              >
                🐺 Simulate All Werewolf Votes
              </Button>
            </div>
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

      {/* Werewolf Voting Modal */}
      <WerewolfVotingModal
        currentPlayerName={activePlayer.name}
        isOpen={isWerewolfVotingOpen}
        onClose={() => setIsWerewolfVotingOpen(false)}
        playersList={activePlayer.playersList}
      />

      {/* Werewolf Simulation Modal */}
      <WerewolfSimulationModal
        currentPlayerName={activePlayer.name}
        isOpen={isWerewolfSimulationOpen}
        onClose={() => setIsWerewolfSimulationOpen(false)}
        onSimulateVotes={simulateAllWerewolfVotes}
        playersList={activePlayer.playersList}
      />

      {/* Witch Heal Modal */}
      <WitchHealModal
        isOpen={activePlayer.showHealModal}
        onClose={() => closeHealModal(activePlayer.id)}
        onHeal={() => healPlayer(activePlayer.id)}
        onSkip={() => skipHeal(activePlayer.id)}
        playersList={activePlayer.playersList}
        werewolfVictimId={activePlayer.werewolfVictimId}
      />

      {/* Witch Poison Modal */}
      <WitchPoisonModal
        currentPlayerName={activePlayer.name}
        isOpen={activePlayer.showPoisonModal}
        onClose={() => closePoisonModal(activePlayer.id)}
        onPoison={(targetPlayerId: string) =>
          poisonPlayer(activePlayer.id, targetPlayerId)
        }
        onSkip={() => skipPoison(activePlayer.id)}
        playersList={activePlayer.playersList}
      />
    </div>
  );
}
