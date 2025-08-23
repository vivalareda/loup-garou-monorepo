import type {
  PlayerGetters,
  PlayerListItem,
  PlayerSetters,
  Role,
  WaitingRoomPlayer,
} from '@repo/types';

export class Player implements PlayerGetters, PlayerSetters {
  readonly name: string;
  readonly socketId: string;
  role: Role | null;
  isAlive: boolean;

  constructor(name: string, sid: string) {
    this.name = name;
    this.role = null;
    this.isAlive = true;
    this.socketId = sid;
  }

  getPlayerForClient() {
    const playerListItem: PlayerListItem = {
      name: this.name,
      socketId: this.socketId,
    };
    return playerListItem;
  }

  getWaitingRoomData() {
    const waitingRoomPlayer: WaitingRoomPlayer = {
      type: 'waiting',
      name: this.name,
      socketId: this.socketId,
    };
    return waitingRoomPlayer;
  }

  setRole(role: Role) {
    this.role = role;
  }

  getRole() {
    if (!this.role) {
      throw new Error('Role is not assigned to the player');
    }
    return this.role;
  }

  getSocketId() {
    return this.socketId;
  }

  getName() {
    return this.name;
  }

  kill() {
    this.isAlive = false;
  }

  setIsAlive(value: boolean) {
    this.isAlive = value;
  }

  getSocket() {
    return this.socketId;
  }

  assignRole(role: Role) {
    this.role = role;
  }
}
