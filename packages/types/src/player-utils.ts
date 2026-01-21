import type { LobbyPlayer, Player, PlayerIdentity } from './player';
import type { Role } from './role';

export type PlayerListItem = {
  name: string;
  socketId: string;
};

export type WaitingRoomPlayer = {
  type: 'waiting';
  name: string;
  socketId: string;
};

export type GamePlayer = PlayerIdentity & {
  readonly type: 'game';
  role: Role;
  isAlive: boolean;
};

export const createLobbyPlayer = (
  name: string,
  socketId: string
): LobbyPlayer => ({
  type: 'lobby',
  name,
  socketId,
});

export const toGamePlayer = (
  lobbyPlayer: LobbyPlayer,
  role: Role
): GamePlayer => ({
  type: 'game',
  name: lobbyPlayer.name,
  socketId: lobbyPlayer.socketId,
  role,
  isAlive: true,
});

export const killPlayer = (player: GamePlayer): void => {
  player.isAlive = false;
};

export const assignRole = (player: GamePlayer, role: Role): void => {
  player.role = role;
};

export const toPlayerListItem = (player: Player): PlayerListItem => ({
  name: player.name,
  socketId: player.socketId,
});

export const toWaitingRoomPlayer = (
  player: LobbyPlayer
): WaitingRoomPlayer => ({
  type: 'waiting',
  name: player.name,
  socketId: player.socketId,
});
