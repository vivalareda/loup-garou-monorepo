import type { PlayerIdentity, Role } from '@repo/types';

export class Player {
  readonly name: string;
  readonly socketId: string;
  role: Role;
  isAlive: boolean;

  constructor(name: string, sid: string, role: Role) {
    this.name = name;
    this.role = role;
    this.isAlive = true;
    this.socketId = sid;
  }

  getIdentity() {
    const identity: PlayerIdentity = {
      name: this.name,
      sid: this.socketId,
    };

    return identity;
  }

  // getPlayerForClient() {
  //   const playerListItem: PlayerListItem = {
  //     name: this.name,
  //     socketId: this.socketId,
  //   };
  //   return playerListItem;
  // }
  //
  // getWaitingRoomData() {
  //   const waitingRoomPlayer: WaitingRoomPlayer = {
  //     type: 'waiting',
  //     name: this.name,
  //     socketId: this.socketId,
  //   };
  //   return waitingRoomPlayer;
  // }

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

  assignRole(role: Role) {
    this.role = role;
  }
}
