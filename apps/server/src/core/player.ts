import type {
  PlayerGetters,
  PlayerListItem,
  PlayerSetters,
  Role,
  WaitingRoomPlayer,
} from '@repo/types';
import type { SocketType } from '@/server/sockets';

export class Player implements PlayerGetters, PlayerSetters {
  readonly name: string;
  readonly socketId: string;
  readonly io: SocketType;
  role: Role | null;
  isAlive: boolean;

  constructor(name: string, sid: string, io: SocketType) {
    this.name = name;
    this.role = null;
    this.isAlive = true;
    this.socketId = sid;
    this.io = io;
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

    this.io.to(this.socketId).emit('alert:player-is-dead');

    this.io.emit('lobby:player-died', this.socketId);

    console.log(`💀 Player ${this.name} (${this.socketId}) has been killed`);
  }

  setIsAlive(value: boolean) {
    this.isAlive = value;
  }

  assignRole(role: Role) {
    this.role = role;
  }
}
