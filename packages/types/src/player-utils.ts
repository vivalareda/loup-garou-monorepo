import type { GamePlayer, LobbyPlayer } from './player';
import type { Role } from './role';

export const createLobbyPlayer = (name: string, sid: string): LobbyPlayer => ({
  type: 'lobby',
  name,
  sid,
});

export const toGamePlayer = (
  lobbyPlayer: LobbyPlayer,
  role: Role
): GamePlayer => ({
  type: 'game',
  name: lobbyPlayer.name,
  sid: lobbyPlayer.sid,
  role,
  isAlive: true,
});

export const killPlayer = (player: GamePlayer): void => {
  player.isAlive = false;
};

export const assignRole = (player: GamePlayer, role: Role): void => {
  player.role = role;
};
