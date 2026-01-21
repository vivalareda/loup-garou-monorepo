import type { Role } from './role';

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
