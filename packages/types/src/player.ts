import type { Role } from './role';

export type GamePlayer = {
  type: 'game';
  name: string;
  socketId: string;
  sessionToken?: string;
  isAlive: boolean;
  role: Role;
};

export type PlayerGetters = {
  [K in keyof GamePlayer as K extends 'type' | 'isAlive' | 'sessionToken'
    ? never
    : `get${Capitalize<K>}`]: () => GamePlayer[K];
};

export type PlayerSetters = {
  [K in keyof GamePlayer as K extends 'isAlive' | 'role'
    ? `set${Capitalize<K>}`
    : never]: (value: GamePlayer[K]) => void;
};

export type Player = GamePlayer | WaitingRoomPlayer;

export type PlayerListItem = Pick<Player, 'name' | 'socketId'>;

export type WaitingRoomPlayer = Pick<GamePlayer, 'name' | 'socketId'> & {
  type: 'waiting';
  sessionToken?: string;
};

export function isGamePlayer(player: Player) {
  return player.type === 'game';
}

/** A player entry in the end-of-game reveal. Roles are public once the
 * game is finished, and only then. */
export type RevealedPlayer = {
  name: string;
  socketId: string;
  role: Role | null;
  isAlive: boolean;
};

export type GameEndResult = {
  winningFaction: 'villagers' | 'werewolves';
  players: RevealedPlayer[];
};
