import { Button } from '@/components/ui/button';
import type { MockPlayer } from '@/store/mock-players';
import { getStatusClassName } from '@/utils/status';

type PlayerHeaderProps = {
  player: MockPlayer;
  onConnect: () => void;
  onDisconnect: () => void;
};

export function PlayerHeader({
  player,
  onConnect,
  onDisconnect,
}: PlayerHeaderProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{player.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${getStatusClassName(player.status)}`}
            >
              {player.status}
            </span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                player.isConnected
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {player.isConnected ? 'Connected' : 'Disconnected'}
            </span>
            {player.isLover && (
              <span className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-800">
                💕 Lover
              </span>
            )}
            {player.isCupid && (
              <span className="rounded bg-pink-100 px-2 py-1 text-xs font-medium text-pink-800">
                💘 Cupid
              </span>
            )}
            {player.player &&
              !player.player.isAlive &&
              'role' in player.player && (
                <span className="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">
                  💀 Dead
                </span>
              )}
          </div>
        </div>
        <div className="flex gap-2">
          {player.isConnected ? (
            <Button onClick={onDisconnect} variant="outline">
              Disconnect
            </Button>
          ) : (
            <Button onClick={onConnect}>Connect</Button>
          )}
        </div>
      </div>
    </div>
  );
}
