import type { Role } from './role.js';

export type PlayerIdentity = {
  readonly name: string;
  readonly sid: string;
};

export type PlayerListItem = {
  name: string;
  socketId: string;
};

export type WaitingRoomPlayer = {
  type: 'waiting';
  name: string;
  socketId: string;
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
