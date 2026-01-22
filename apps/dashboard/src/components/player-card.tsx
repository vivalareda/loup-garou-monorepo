import { isGamePlayer } from '@repo/types';
import { Ghost, Power, PowerOff, Skull, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MockPlayer } from '@/store/mock-players';
import { getRoleClassName } from '@/utils/status';

type PlayerCardProps = {
  player: MockPlayer;
  onSelect: () => void;
  onRemove: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onAssignWerewolfRole: () => void;
  onAssignWitchRole: () => void;
  onWerewolfVote: () => void;
  onWerewolfSimulate: () => void;
};

function PlayerInfo({ player }: { player: MockPlayer }) {
  const playerRole =
    player.player && isGamePlayer(player.player) ? player.player.role : null;
  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Status:</span>
        <span className="font-medium text-foreground capitalize">
          {player.status}
        </span>
      </div>

      {playerRole && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Role:</span>
          <span
            className={`rounded px-2 py-1 text-xs font-medium ${getRoleClassName(playerRole)}`}
          >
            {playerRole}
          </span>
        </div>
      )}

      {!isAlive && (
        <div className="flex items-center justify-between">
          <span className="text-destructive font-medium">Dead</span>
          <Ghost className="h-4 w-4 text-destructive" />
        </div>
      )}

      {player.playersList.length > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Players in view:</span>
          <span className="font-medium text-foreground">
            {player.playersList.length}
          </span>
        </div>
      )}
    </div>
  );
}

function PlayerActions({
  player,
  onConnect,
  onDisconnect,
  onSelect,
  onAssignWerewolfRole,
  onAssignWitchRole,
  onWerewolfVote,
  onWerewolfSimulate,
}: PlayerCardProps) {
  const playerRole =
    player.player && isGamePlayer(player.player) ? player.player.role : null;
  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      <div className="flex gap-2">
        <Button
          className="flex-1"
          onClick={() => (player.isConnected ? onDisconnect() : onConnect())}
          size="sm"
          variant={player.isConnected ? 'destructive' : 'default'}
        >
          {player.isConnected ? (
            <>
              <PowerOff className="h-3 w-3 mr-1" />
              Disconnect
            </>
          ) : (
            <>
              <Power className="h-3 w-3 mr-1" />
              Connect
            </>
          )}
        </Button>
        <Button
          className="flex-1"
          onClick={onSelect}
          size="sm"
          variant="outline"
        >
          Details
        </Button>
      </div>

      {player.status === 'in-game' && isAlive && (
        <div className="space-y-1 pt-2">
          <p className="text-xs font-medium text-muted-foreground">
            Assign Role:
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 text-xs"
              onClick={onAssignWerewolfRole}
              size="sm"
              variant="outline"
            >
              🐺 Werewolf
            </Button>
            <Button
              className="flex-1 text-xs"
              onClick={onAssignWitchRole}
              size="sm"
              variant="outline"
            >
              🧙 Witch
            </Button>
          </div>
        </div>
      )}

      {playerRole === 'WEREWOLF' && isAlive && (
        <div className="space-y-1 pt-2">
          <p className="text-xs font-medium text-muted-foreground">
            🐺 Werewolf Actions:
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1 text-xs"
              onClick={onWerewolfVote}
              size="sm"
              variant="destructive"
            >
              <Skull className="h-3 w-3 mr-1" />
              Vote
            </Button>
            <Button
              className="flex-1 text-xs"
              onClick={onWerewolfSimulate}
              size="sm"
              variant="secondary"
            >
              <Zap className="h-3 w-3 mr-1" />
              Simulate
            </Button>
          </div>
        </div>
      )}

      {playerRole === 'WITCH' && isAlive && (
        <div className="pt-2">
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-2">
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">
              🧙 Witch modals will appear automatically when prompted
            </p>
          </div>
        </div>
      )}

      {playerRole === 'VILLAGER' && isAlive && (
        <div className="pt-2">
          <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400">
              👤 Vote during the day phase to eliminate suspects
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlayerCard({ player, onRemove, ...props }: PlayerCardProps) {
  const isAlive =
    player.player && isGamePlayer(player.player) ? player.player.isAlive : true;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:shadow-lg ${
        player.isConnected ? '' : 'opacity-60'
      }`}
    >
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          className="rounded p-1 text-destructive hover:bg-destructive/10"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove player"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-foreground">
            {player.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-sm">
            {player.isConnected ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <span className="h-2 w-2 rounded-full bg-green-600 dark:bg-green-400" />
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-500">
                <span className="h-2 w-2 rounded-full bg-gray-500" />
                Disconnected
              </span>
            )}
          </div>
        </div>
        <div className="text-3xl">{isAlive ? '👤' : '💀'}</div>
      </div>

      <PlayerInfo player={player} />
      <PlayerActions onRemove={onRemove} player={player} {...props} />
    </div>
  );
}
