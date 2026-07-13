import type {
  PlayerGetters,
  PlayerListItem,
  PlayerSetters,
  Role,
  WaitingRoomPlayer,
} from '@repo/types';
import type { SocketType } from '@/server/sockets';
import { randomUUID } from 'node:crypto';

export class Player implements PlayerGetters, PlayerSetters {
  readonly name: string;
  socketId: string;
  readonly sessionToken: string;
  readonly io: SocketType;
  role: Role | null;
  isAlive: boolean;
  /** False while the player's transport is down and their grace period is
   * running. A disconnected player is not required for phase completion. */
  isConnected: boolean;

  constructor(name: string, sid: string, io: SocketType) {
    this.name = name;
    this.role = null;
    this.isAlive = true;
    this.isConnected = true;
    this.socketId = sid;
    this.sessionToken = randomUUID();
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
      sessionToken: this.sessionToken,
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

  setSocketId(socketId: string) {
    this.socketId = socketId;
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
