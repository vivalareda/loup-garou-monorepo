import { useState } from 'react';
import { useMockPlayerStore } from '@/store/mock-players';
import { DayVoteModal } from './day-vote-modal';
import { PlayerHeader } from './player-header';
import { PlayerInfo } from './player-info';
import { PlayersList } from './players-list';
import { RoleActions } from './role-actions';
import { SocketEvents } from './socket-events';
import { TestSimulation } from './test-simulation';
import { WerewolfSimulationModal } from './werewolf-simulation-modal';
import { WerewolfVotingModal } from './werewolf-voting-modal';
import { WitchHealModal } from './witch-heal-modal';
import { WitchPoisonModal } from './witch-poison-modal';

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
    healPlayer,
    skipHeal,
    poisonPlayer,
    skipPoison,
    closeHealModal,
    closePoisonModal,
    simulateAllDayVotes,
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
        <PlayerHeader
          onConnect={() => connectPlayer(activePlayer.id)}
          onDisconnect={() => disconnectPlayer(activePlayer.id)}
          player={activePlayer}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <PlayerInfo
            onAssignWerewolfRole={assignWerewolfRole}
            onAssignWitchRole={assignWitchRole}
            onSendLoverClosedAlert={sendLoverClosedAlert}
            onSendLoverSelection={sendLoverSelection}
            onToggleLoverSelection={toggleLoverSelection}
            player={activePlayer}
          />
          <PlayersList player={activePlayer} players={players} />
        </div>

        <RoleActions
          onOpenWerewolfVoting={setIsWerewolfVotingOpen}
          player={activePlayer}
        />

        <TestSimulation
          isAlive={activePlayer.player ? activePlayer.player.isAlive : true}
          onOpenWerewolfSimulation={setIsWerewolfSimulationOpen}
          onSimulateDayVotes={simulateAllDayVotes}
          playersList={activePlayer.playersList}
        />

        <SocketEvents />
      </div>

      <WerewolfVotingModal
        currentPlayerName={activePlayer.name}
        isOpen={isWerewolfVotingOpen}
        onClose={() => setIsWerewolfVotingOpen(false)}
        playersList={activePlayer.playersList}
      />

      <WerewolfSimulationModal
        currentPlayerName={activePlayer.name}
        isOpen={isWerewolfSimulationOpen}
        onClose={() => setIsWerewolfSimulationOpen(false)}
        onSimulateVotes={simulateAllWerewolfVotes}
        playersList={activePlayer.playersList}
      />

      {activePlayer.player && 'isAlive' in activePlayer.player && (
        <>
          <WitchHealModal
            isOpen={Boolean(
              activePlayer.showHealModal && activePlayer.player.isAlive
            )}
            onClose={() => closeHealModal(activePlayer.id)}
            onHeal={() => healPlayer(activePlayer.id)}
            onSkip={() => skipHeal(activePlayer.id)}
            playersList={activePlayer.playersList}
            werewolfVictimId={activePlayer.werewolfVictimId}
          />

          <WitchPoisonModal
            currentPlayerName={activePlayer.name}
            isOpen={Boolean(
              activePlayer.showPoisonModal && activePlayer.player.isAlive
            )}
            onClose={() => closePoisonModal(activePlayer.id)}
            onPoison={(targetPlayerId: string) =>
              poisonPlayer(activePlayer.id, targetPlayerId)
            }
            onSkip={() => skipPoison(activePlayer.id)}
            playersList={activePlayer.playersList}
          />

          {activePlayer.player.isAlive && (
            <DayVoteModal playerId={activePlayer.id} />
          )}
        </>
      )}
    </div>
  );
}
