import { isGamePlayer, type PlayerIdentity } from '@repo/types';
import type { MockPlayer } from '@/store/mock-players';
import { getRoleClassName } from '@/utils/status';

type PlayersListProps = {
  player: MockPlayer;
  players: Map<string, MockPlayer>;
};

function PlayerListItem({
  player,
  playerListItem,
  players,
}: {
  player: MockPlayer;
  playerListItem: PlayerIdentity;
  players: Map<string, MockPlayer>;
}) {
  const mockPlayerWithRole = Array.from(players.values()).find(
    (mp) => mp.name === playerListItem.name
  );
  const playerRole =
    mockPlayerWithRole?.player && isGamePlayer(mockPlayerWithRole.player)
      ? mockPlayerWithRole.player.role
      : null;
  const isPlayerAlive =
    mockPlayerWithRole?.player && isGamePlayer(mockPlayerWithRole.player)
      ? mockPlayerWithRole.player.isAlive
      : true;

  return (
    <div
      className={`flex items-center gap-2 rounded p-2 ${
        isPlayerAlive ? 'bg-gray-50' : 'bg-red-50 opacity-75'
      }`}
      key={playerListItem.sid}
    >
      <span className="text-gray-600">{isPlayerAlive ? '👤' : '💀'}</span>
      <span
        className={`${
          isPlayerAlive ? 'text-gray-800' : 'text-gray-500 line-through'
        }`}
      >
        {playerListItem.name}
      </span>
      {player.status === 'in-game' && playerRole && (
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${getRoleClassName(playerRole)}`}
        >
          {playerRole}
        </span>
      )}
      {playerListItem.name === player.name && (
        <span className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
          You
        </span>
      )}
      {!isPlayerAlive && (
        <span className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
          Dead
        </span>
      )}
    </div>
  );
}

export function PlayersList({ player, players }: PlayersListProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        {player.status === 'in-game'
          ? `Players in Game (${player.playersList.length})`
          : `Players in Lobby (${player.playersList.length})`}
      </h2>
      {player.playersList.length === 0 ? (
        <div className="py-4 text-center text-gray-500">
          No players in waiting room
        </div>
      ) : (
        <div className="space-y-2">
          {player.playersList.map((playerListItem) => (
            <PlayerListItem
              key={playerListItem.sid}
              player={player}
              playerListItem={playerListItem}
              players={players}
            />
          ))}
        </div>
      )}
    </div>
  );
}
