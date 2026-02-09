import { Context, Effect, Layer, Ref } from 'effect';
import { LobbyPlayer } from '../core/LobbyPlayer.js';
import { LobbyFullError, NameExistsError } from './errors.js';
import { LobbyConfig } from './LobbyConfig.js';

const makeLobby = Effect.gen(function* () {
  const config = yield* LobbyConfig;
  const players = yield* Ref.make<readonly LobbyPlayer[]>([]);

  type AddResult =
    | { readonly _tag: 'NameTaken' }
    | { readonly _tag: 'LobbyFull' }
    | { readonly _tag: 'Added'; readonly player: LobbyPlayer };

  const addPlayer = Effect.fn('addPlayer')(function* (
    name: string,
    sid: string
  ) {
    const result = yield* Ref.modify(
      players,
      (ps): readonly [AddResult, readonly LobbyPlayer[]] => {
        if (ps.some((p) => p.name === name)) {
          return [{ _tag: 'NameTaken' }, ps];
        }
        if (ps.length >= config.maxPlayers) {
          return [{ _tag: 'LobbyFull' }, ps];
        }
        const player = new LobbyPlayer(name, sid);
        return [{ _tag: 'Added', player }, [...ps, player]];
      }
    );
    switch (result._tag) {
      case 'NameTaken':
        return yield* new NameExistsError();
      case 'LobbyFull':
        return yield* new LobbyFullError();
      default:
        return result.player;
    }
  });

  return {
    addPlayer,
    getAllPlayers: Ref.get(players).pipe(Effect.map((ps) => [...ps])),
    getPlayerCount: Ref.get(players).pipe(Effect.map((ps) => ps.length)),
    isLobbyFull: Ref.get(players).pipe(
      Effect.map((ps) => ps.length >= config.maxPlayers)
    ),
    clear: Ref.set(players, []),
  };
});

type LobbyService = typeof makeLobby extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class Lobby extends Context.Tag('@app/Lobby')<Lobby, LobbyService>() {
  static readonly DefaultWithoutDependencies = Layer.effect(this, makeLobby);
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(LobbyConfig.Live)
  );
}
