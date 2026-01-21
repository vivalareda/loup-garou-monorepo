export class LobbyPlayer {
  readonly type = 'lobby' as const;

  readonly name: string;
  readonly socketId: string;

  constructor(name: string, socketId: string) {
    this.name = name;
    this.socketId = socketId;
  }

  get sid() {
    return this.socketId;
  }
}
