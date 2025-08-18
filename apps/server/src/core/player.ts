import type { Role, WaitingRoomPlayer } from '@repo/types';

export class Player {
  readonly name: string;
  readonly sid: string;
  role: Role | null;
  isAlive: boolean;

  constructor(name: string, sid: string) {
    this.name = name;
    this.role = null;
    this.isAlive = true;
    this.sid = sid;
  }

  getWaitingRoomData() {
    const waitingRoomPlayer: WaitingRoomPlayer = {
      type: 'waiting',
      name: this.name,
      sid: this.sid,
    };
    return waitingRoomPlayer;
  }

  assignRole(role: Role) {
    this.role = role;
  }

  getRole() {
    return this.role;
  }

  getSocket() {
    return this.sid;
  }

  getName() {
    return this.name;
  }

  kill() {
    this.isAlive = false;
  }
}
