import { isGamePlayer } from '@repo/types';
import { Button } from '@/components/ui/button';
import type { MockPlayer } from '@/store/mock-players';

type PlayerInfoProps = {
  player: MockPlayer;
  onAssignWerewolfRole: (playerId: string) => void;
  onAssignWitchRole: (playerId: string) => void;
  onSendLoverClosedAlert: (playerId: string) => void;
  onToggleLoverSelection: (playerId: string, loverName: string) => void;
  onSendLoverSelection: (playerId: string) => void;
};

export function PlayerInfo({
  player,
  onAssignWerewolfRole,
  onAssignWitchRole,
  onSendLoverClosedAlert,
  onToggleLoverSelection,
  onSendLoverSelection,
}: PlayerInfoProps) {
  const loverName = player.loverName
    ? (player.playersList.find((lover) => lover.sid === player.loverName)
        ?.name ?? player.loverName)
    : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Player Data</h2>
      <div className="space-y-3">
        <div>
          <div className="text-sm font-medium text-gray-600">Name</div>
          <div className="text-gray-800">{player.name}</div>
        </div>
        <div>
          <div className="text-sm font-medium text-gray-600">Socket ID</div>
          <div className="font-mono text-sm text-gray-800">
            {player.socket.id || 'Not connected'}
          </div>
        </div>
        {player.player && (
          <>
            <div>
              <div className="text-sm font-medium text-gray-600">
                Player Object
              </div>
              <pre className="mt-1 rounded bg-gray-50 p-2 text-xs">
                {JSON.stringify(player.player, null, 2)}
              </pre>
            </div>
            {isGamePlayer(player.player) && (
              <div>
                <div className="text-sm font-medium text-gray-600">Role</div>
                <div className="text-lg font-bold text-blue-600">
                  {player.player.role}
                </div>
                <div className="mt-2">
                  <div className="text-sm font-medium text-gray-600">
                    Status
                  </div>
                  <div
                    className={`text-lg font-bold ${
                      player.player.isAlive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {player.player.isAlive ? (
                      <>
                        <span className="mr-2">💚</span>
                        Alive
                      </>
                    ) : (
                      <>
                        <span className="mr-2">💀</span>
                        Dead
                      </>
                    )}
                  </div>
                </div>
                {player.player.role !== 'WEREWOLF' && (
                  <Button
                    className="mt-2 bg-red-600 text-xs hover:bg-red-700"
                    onClick={() => onAssignWerewolfRole(player.id)}
                    size="sm"
                  >
                    🧪 Test: Assign Werewolf Role
                  </Button>
                )}
                {player.player.role !== 'WITCH' && (
                  <Button
                    className="ml-2 mt-2 bg-purple-600 text-xs hover:bg-purple-700"
                    onClick={() => onAssignWitchRole(player.id)}
                    size="sm"
                  >
                    🧪 Test: Assign Witch Role
                  </Button>
                )}
              </div>
            )}
          </>
        )}
        {player.isLover && (
          <div>
            <div className="text-sm font-medium text-gray-600">
              Lover Status
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">💕</span>
              <span className="font-medium text-red-600">
                In love with {loverName || 'Unknown'}
              </span>
            </div>
            <Button
              className="mt-2"
              disabled={!player.canCloseLoverAlert}
              onClick={() => onSendLoverClosedAlert(player.id)}
              size="sm"
            >
              Close Lover Alert
            </Button>
          </div>
        )}
        {player.isCupid && player.canSelectLovers && (
          <div>
            <div className="text-sm font-medium text-gray-600">
              Cupid - Select Two Lovers
            </div>
            <div className="mt-2 space-y-2">
              {player.playersList
                .filter(
                  (p) => p.sid !== (player.player?.sid ?? player.socket.id)
                )
                .map((p) => (
                  <button
                    className={`flex cursor-pointer items-center gap-2 rounded p-2 transition-colors${
                      player.selectedLovers.includes(p.name)
                        ? 'bg-pink-100 border-2 border-pink-300'
                        : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                    }`}
                    key={p.sid}
                    onClick={() => onToggleLoverSelection(player.id, p.name)}
                    type="button"
                  >
                    <span className="text-gray-600">
                      {player.selectedLovers.includes(p.name) ? '💘' : '👤'}
                    </span>
                    <span className="text-gray-800">{p.name}</span>
                    {player.selectedLovers.includes(p.name) && (
                      <span className="text-xs font-medium text-pink-600">
                        Selected
                      </span>
                    )}
                  </button>
                ))}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button
                className="bg-pink-600 hover:bg-pink-700"
                disabled={player.selectedLovers.length !== 2}
                onClick={() => onSendLoverSelection(player.id)}
              >
                Confirm Lover Selection ({player.selectedLovers.length}/2)
              </Button>
              {player.selectedLovers.length > 0 && (
                <span className="text-sm text-gray-600">
                  Selected: {player.selectedLovers.join(', ')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
