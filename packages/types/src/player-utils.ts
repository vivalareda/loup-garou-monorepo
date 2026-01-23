import type { Role } from './role';
import type { PlayerIdentity } from './player';

export type { PlayerIdentity } from './player';

export type WaitingRoomPlayer = {
  type: 'waiting';
  name: string;
  sid: string;
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
  sid: string
): LobbyPlayer => ({
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

export const toPlayerIdentity = (player: Player): PlayerIdentity => ({
  name: player.name,
  sid: player.sid,
});

export const toWaitingRoomPlayer = (
  player: LobbyPlayer
): WaitingRoomPlayer => ({
  type: 'waiting',
  name: player.name,
  sid: player.sid,
});
