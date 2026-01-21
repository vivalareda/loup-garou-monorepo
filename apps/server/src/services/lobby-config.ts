import { Context, Effect, Layer } from 'effect';

export class LobbyConfig extends Context.Tag('LobbyConfig')<
  LobbyConfig,
  { maxPlayers: number }
>() {
  static readonly Live = Layer.effect(this, Effect.succeed({ maxPlayers: 6 }));
  static readonly Test = Layer.effect(this, Effect.succeed({ maxPlayers: 2 }));
}
