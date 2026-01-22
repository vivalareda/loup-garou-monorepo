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

export type PlayerIdentity = {
  readonly name: string;
  readonly socketId: string;
};

export type LobbyPlayer = PlayerIdentity & {
  readonly type: 'lobby';
};

export type GamePlayer = PlayerIdentity & {
  readonly type: 'game';
  role: Role;
  isAlive: boolean;
};

export type Player = LobbyPlayer | GamePlayer;

export const isLobbyPlayer = (player: Player): player is LobbyPlayer =>
  player.type === 'lobby';

export const isGamePlayer = (player: Player): player is GamePlayer =>
  player.type === 'game';

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
