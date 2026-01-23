import { Dialog } from '@radix-ui/react-dialog';
import { isGamePlayer } from '@repo/types';
import {
  Gamepad2,
  Heart,
  HeartCrack,
  Skull,
  Sparkles,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { MockPlayer } from '@/store/mock-players';
import { getRoleClassName, getStatusClassName } from '@/utils/status';

type PlayerDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  player: MockPlayer;
  onConnect: () => void;
  onDisconnect: () => void;
};

function OverviewTab({ player }: { player: MockPlayer }) {
  const playerRole =
    player.player && isGamePlayer(player.player) ? player.player.role : null;
  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-accent p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Heart className="h-4 w-4" />
            Status
          </div>
          <div className="text-lg font-semibold text-foreground">
            {isAlive ? 'Alive' : 'Dead'}
          </div>
        </div>

        {playerRole && (
          <div className="rounded-lg bg-accent p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              Role
            </div>
            <div
              className={`text-lg font-semibold ${getRoleClassName(playerRole)} px-2 py-1 rounded inline-block`}
            >
              {playerRole}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg bg-accent p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Users className="h-4 w-4" />
          Players in View
        </div>
        <div className="text-lg font-semibold text-foreground">
          {player.playersList.length} players
        </div>
      </div>

      {playerRole === 'WEREWOLF' && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400 mb-2">
            <Skull className="h-4 w-4" />🐺 Werewolf Information
          </div>
          <p className="text-sm text-foreground">
            As a werewolf, you hunt villagers each night. Work with other
            werewolves to eliminate all villagers to win.
          </p>
        </div>
      )}

      {playerRole === 'WITCH' && (
        <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-purple-600 dark:text-purple-400 mb-2">
            <Sparkles className="h-4 w-4" />🧙 Witch Information
          </div>
          <p className="text-sm text-foreground">
            As a witch, you have two potions: one to heal and one to poison. Use
            them wisely to help the village or eliminate threats.
          </p>
        </div>
      )}

      {playerRole === 'VILLAGER' && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 mb-2">
            <Heart className="h-4 w-4" />👤 Villager Information
          </div>
          <p className="text-sm text-foreground">
            As a villager, work with others to identify and eliminate all
            werewolves through voting during the day.
          </p>
        </div>
      )}
    </div>
  );
}

function PlayersTab({ player }: { player: MockPlayer }) {
  if (player.playersList.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No players in view
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-auto">
      {player.playersList.map((p) => (
        <div
          className="flex items-center justify-between p-3 rounded-lg bg-accent"
          key={p.sid}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">👤</span>
            <span className="font-medium text-foreground">{p.name}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {p.sid.slice(0, 8)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ActionsTab({
  player,
  onConnect,
  onDisconnect,
}: {
  player: MockPlayer;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const playerRole =
    player.player && isGamePlayer(player.player) ? player.player.role : null;
  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-accent p-4">
        <h3 className="font-semibold text-foreground mb-3">
          Connection Actions
        </h3>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={() => (player.isConnected ? onDisconnect() : onConnect())}
            variant={player.isConnected ? 'destructive' : 'default'}
          >
            {player.isConnected ? (
              <>
                <HeartCrack className="h-4 w-4 mr-2" />
                Disconnect
              </>
            ) : (
              <>
                <Heart className="h-4 w-4 mr-2" />
                Connect
              </>
            )}
          </Button>
        </div>
      </div>

      {player.status === 'in-game' && !playerRole && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-4">
          <h3 className="font-semibold text-yellow-600 dark:text-yellow-400 mb-3">
            ⚠️ No Role Assigned
          </h3>
          <p className="text-sm text-foreground">
            This player needs a role assigned to participate in the game.
          </p>
        </div>
      )}

      {!isAlive && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
          <h3 className="font-semibold text-destructive mb-3">
            💀 Player is Dead
          </h3>
          <p className="text-sm text-foreground">
            This player can no longer participate in the game.
          </p>
        </div>
      )}
    </div>
  );
}

export function PlayerDetailModal({
  isOpen,
  onClose,
  player,
  onConnect,
  onDisconnect,
}: PlayerDetailModalProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'players' | 'actions'
  >('overview');

  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="relative w-full max-w-2xl max-h-[90vh] overflow-auto rounded-xl bg-card border border-border shadow-2xl">
          <button
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            onClick={onClose}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="p-6">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-2xl">
                    {isAlive ? '👤' : '💀'}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {player.name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusClassName(player.status)}`}
                      >
                        {player.status}
                      </span>
                      {player.isConnected ? (
                        <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600 dark:bg-green-400" />
                          Connected
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-gray-500" />
                          Disconnected
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 flex gap-2 border-b border-border">
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'overview'
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
                onClick={() => setActiveTab('overview')}
                type="button"
              >
                <Gamepad2 className="h-4 w-4 inline mr-1" />
                Overview
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'players'
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
                onClick={() => setActiveTab('players')}
                type="button"
              >
                <Users className="h-4 w-4 inline mr-1" />
                Players ({player.playersList.length})
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === 'actions'
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
                onClick={() => setActiveTab('actions')}
                type="button"
              >
                <Zap className="h-4 w-4 inline mr-1" />
                Actions
              </button>
            </div>

            <div className="mt-6">
              {activeTab === 'overview' && <OverviewTab player={player} />}
              {activeTab === 'players' && <PlayersTab player={player} />}
              {activeTab === 'actions' && (
                <ActionsTab
                  onConnect={onConnect}
                  onDisconnect={onDisconnect}
                  player={player}
                />
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-border flex justify-end">
              <Button onClick={onClose} variant="outline">
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
