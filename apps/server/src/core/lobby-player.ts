export class LobbyPlayer {
  readonly type = 'lobby' as const;

  readonly name: string;
  readonly sid: string;

  constructor(name: string, sid: string) {
    this.name = name;
    this.sid = sid;
  }
}
