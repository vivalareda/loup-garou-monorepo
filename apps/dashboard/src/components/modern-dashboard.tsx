import { isGamePlayer, type SegmentType } from '@repo/types';
import { Moon, Plus, Server, Sun, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useMockPlayerStore } from '@/store/mock-players';
import { socket } from '@/utils/socket';
import { CupidSelectionModal } from './cupid-selection-modal';
import { DayVoteModal } from './day-vote-modal';
import { PlayerCard } from './player-card';
import { PlayerDetailModal } from './player-detail-modal';
import { WerewolfSimulationModal } from './werewolf-simulation-modal';
import { WerewolfVotingModal } from './werewolf-voting-modal';
import { WitchHealModal } from './witch-heal-modal';
import { WitchPoisonModal } from './witch-poison-modal';

type ModernDashboardProps = {
  isDarkMode: boolean;
  setIsDarkMode: (value: boolean) => void;
  onAddPlayer: () => void;
  onBatchAddPlayers: () => void;
  onModernSegmentClick: () => void;
  mockSegment: SegmentType | undefined;
};

export function ModernDashboard({
  isDarkMode,
  setIsDarkMode,
  onAddPlayer,
  onBatchAddPlayers,
  onModernSegmentClick,
  mockSegment,
}: ModernDashboardProps) {
  const {
    players,
    removePlayer,
    connectPlayer,
    disconnectPlayer,
    assignWerewolfRole,
    assignWitchRole,
    simulateAllWerewolfVotes,
    toggleLoverSelection,
    sendLoverClosedAlert,
    sendLoverSelection,
    healPlayer,
    skipHeal,
    poisonPlayer,
    skipPoison,
    closeHealModal,
    closePoisonModal,
  } = useMockPlayerStore();

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isWerewolfVotingOpen, setIsWerewolfVotingOpen] = useState(false);
  const [isWerewolfSimulationOpen, setIsWerewolfSimulationOpen] =
    useState(false);
  const [isCupidSelectionOpen, setIsCupidSelectionOpen] = useState(false);
  const [actionPlayerId, setActionPlayerId] = useState<string | null>(null);

  const playersArray = Array.from(players.values());
  const selectedPlayer = selectedPlayerId
    ? players.get(selectedPlayerId)
    : null;

  const handleWerewolfVote = (targetPlayerName: string) => {
    simulateAllWerewolfVotes(targetPlayerName);
  };

  const handleStartGame = () => {
    mockSegment
      ? socket.emit('lobby:start-mock', mockSegment)
      : socket.emit('lobby:start-game');
  };

  const selectedPlayerForAction = actionPlayerId
    ? players.get(actionPlayerId)
    : null;

  useEffect(() => {
    const playersArray = Array.from(players.values());
    const playerWithHealModal = playersArray.find(
      (p) =>
        p.showHealModal &&
        p.player &&
        isGamePlayer(p.player) &&
        p.player.isAlive
    );
    const playerWithPoisonModal = playersArray.find(
      (p) =>
        p.showPoisonModal &&
        p.player &&
        isGamePlayer(p.player) &&
        p.player.isAlive
    );

    if (playerWithHealModal && !actionPlayerId) {
      setActionPlayerId(playerWithHealModal.id);
    } else if (playerWithPoisonModal && !actionPlayerId) {
      setActionPlayerId(playerWithPoisonModal.id);
    }
  }, [players, actionPlayerId]);

  return (
    <div className="flex h-screen w-full">
      <aside className="flex h-screen w-72 flex-col border-r border-border bg-card p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">Loup Garou</h1>
            <Button
              className="text-foreground hover:bg-accent"
              onClick={() => setIsDarkMode(!isDarkMode)}
              size="icon"
              variant="ghost"
            >
              {isDarkMode ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">Admin Dashboard</p>
        </div>

        <nav className="space-y-2 mb-6">
          <Link
            className="flex items-center gap-3 rounded-lg bg-primary px-4 py-3 text-primary-foreground"
            to="/"
          >
            <Users className="h-5 w-5" />
            <span className="font-medium">Players</span>
          </Link>
          <Link
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            to="/server"
          >
            <Server className="h-5 w-5" />
            <span className="font-medium">Server</span>
          </Link>
        </nav>

        <div className="space-y-3 mb-6">
          <Button className="w-full gap-2 text-white" onClick={handleStartGame}>
            Start Game
          </Button>
          <Button className="w-full gap-2 text-white" onClick={onAddPlayer}>
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
          <Button
            className="w-full gap-2 text-foreground"
            onClick={onBatchAddPlayers}
            variant="outline"
          >
            <UserPlus className="h-4 w-4" />
            Batch Add
          </Button>
          <Button
            className="w-full gap-2 text-foreground"
            onClick={onModernSegmentClick}
            variant="outline"
          >
            <UserPlus className="h-4 w-4" />
            Mock segment
          </Button>
        </div>

        <div className="mb-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3">
            <Users className="h-4 w-4" />
            Players ({playersArray.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {playersArray.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No players yet
            </div>
          ) : (
            playersArray.map((player) => (
              <button
                className={`w-full text-left rounded-lg p-3 transition-all ${
                  selectedPlayerId === player.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 hover:bg-muted text-foreground'
                }`}
                key={player.id}
                onClick={() => setSelectedPlayerId(player.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{player.isConnected ? '🟢' : '🔴'}</span>
                    <span className="font-medium">{player.name}</span>
                  </div>
                  <button
                    className="text-xs opacity-60 hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (player.isConnected) {
                        disconnectPlayer(player.id);
                      } else {
                        connectPlayer(player.id);
                      }
                    }}
                    type="button"
                  >
                    {player.isConnected ? '📶' : '📵'}
                  </button>
                </div>
                {player.player && isGamePlayer(player.player) && (
                  <div className="mt-1 text-xs opacity-80">
                    {player.player.role} •{' '}
                    {player.player.isAlive ? 'Alive' : 'Dead'}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
            <p className="mt-1 text-muted-foreground">
              Manage all players and their actions from a single view
            </p>
          </div>

          {playersArray.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border rounded-xl">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">
                No Players Yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Add players to get started
              </p>
              <Button className="gap-2" onClick={onAddPlayer}>
                <Plus className="h-4 w-4" />
                Add First Player
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {playersArray.map((player) => (
                <PlayerCard
                  key={player.id}
                  onAssignWerewolfRole={() => assignWerewolfRole(player.id)}
                  onAssignWitchRole={() => assignWitchRole(player.id)}
                  onCloseLoverAlert={() => sendLoverClosedAlert(player.id)}
                  onConnect={() => connectPlayer(player.id)}
                  onCupidSelect={() => {
                    setActionPlayerId(player.id);
                    setIsCupidSelectionOpen(true);
                  }}
                  onDisconnect={() => disconnectPlayer(player.id)}
                  onRemove={() => removePlayer(player.id)}
                  onSelect={() => setSelectedPlayerId(player.id)}
                  onWerewolfSimulate={() => {
                    setActionPlayerId(player.id);
                    setIsWerewolfSimulationOpen(true);
                  }}
                  onWerewolfVote={() => {
                    setActionPlayerId(player.id);
                    setIsWerewolfVotingOpen(true);
                  }}
                  player={player}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedPlayer && (
        <PlayerDetailModal
          isOpen={Boolean(selectedPlayerId)}
          onClose={() => setSelectedPlayerId(null)}
          onConnect={() => connectPlayer(selectedPlayer.id)}
          onDisconnect={() => disconnectPlayer(selectedPlayer.id)}
          player={selectedPlayer}
        />
      )}

      {selectedPlayerForAction && (
        <>
          <CupidSelectionModal
            isOpen={isCupidSelectionOpen}
            onClose={() => {
              setIsCupidSelectionOpen(false);
              setActionPlayerId(null);
            }}
            onConfirm={(playerId) => {
              sendLoverSelection(playerId);
              setIsCupidSelectionOpen(false);
              setActionPlayerId(null);
            }}
            onToggleSelection={toggleLoverSelection}
            player={selectedPlayerForAction}
            playersList={selectedPlayerForAction.playersList}
            selectedLovers={selectedPlayerForAction.selectedLovers}
          />

          <WerewolfVotingModal
            currentPlayerName={selectedPlayerForAction.name}
            isOpen={isWerewolfVotingOpen}
            onClose={() => {
              setIsWerewolfVotingOpen(false);
              setActionPlayerId(null);
            }}
            playersList={selectedPlayerForAction.playersList}
          />

          <WerewolfSimulationModal
            currentPlayerName={selectedPlayerForAction.name}
            isOpen={isWerewolfSimulationOpen}
            onClose={() => {
              setIsWerewolfSimulationOpen(false);
              setActionPlayerId(null);
            }}
            onSimulateVotes={handleWerewolfVote}
            playersList={selectedPlayerForAction.playersList}
          />

          {selectedPlayerForAction.player &&
            isGamePlayer(selectedPlayerForAction.player) && (
              <>
                <WitchHealModal
                  isOpen={Boolean(
                    selectedPlayerForAction.showHealModal &&
                      selectedPlayerForAction.player.isAlive
                  )}
                  onClose={() => {
                    closeHealModal(selectedPlayerForAction.id);
                    setActionPlayerId(null);
                  }}
                  onHeal={() => {
                    healPlayer(selectedPlayerForAction.id);
                    setActionPlayerId(null);
                  }}
                  onSkip={() => {
                    skipHeal(selectedPlayerForAction.id);
                    setActionPlayerId(null);
                  }}
                  playersList={selectedPlayerForAction.playersList}
                  werewolfVictimId={selectedPlayerForAction.werewolfVictimId}
                />

                <WitchPoisonModal
                  currentPlayerName={selectedPlayerForAction.name}
                  isOpen={Boolean(
                    selectedPlayerForAction.showPoisonModal &&
                      selectedPlayerForAction.player.isAlive
                  )}
                  onClose={() => {
                    closePoisonModal(selectedPlayerForAction.id);
                    setActionPlayerId(null);
                  }}
                  onPoison={(targetPlayerId) => {
                    poisonPlayer(selectedPlayerForAction.id, targetPlayerId);
                    setActionPlayerId(null);
                  }}
                  onSkip={() => {
                    skipPoison(selectedPlayerForAction.id);
                    setActionPlayerId(null);
                  }}
                  playersList={selectedPlayerForAction.playersList}
                />

                {selectedPlayerForAction.player.isAlive && (
                  <DayVoteModal playerId={selectedPlayerForAction.id} />
                )}
              </>
            )}
        </>
      )}
    </div>
  );
}
