import type { Role } from './role';

export type GamePlayer = {
  type: 'game';
  name: string;
  sid: string;
  isAlive: boolean;
  role: Role;
};

export type PlayerGetters = {
  [K in keyof GamePlayer as `get${Capitalize<K>}`]: () => GamePlayer[K];
};

export type PlayerListItem = Pick<Player, 'name' | 'sid'>;

export type WaitingRoomPlayer = Pick<GamePlayer, 'name' | 'sid'> & {
  type: 'waiting';
};

export type Player = GamePlayer | WaitingRoomPlayer;

export function isGamePlayer(player: Player) {
  return player.type === 'game';
}
