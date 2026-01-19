import { Context, Effect, HashMap, Layer, Ref } from 'effect';
import {
  type Player,
  PlayerAlreadyExists,
  type PlayerId,
  PlayerNotFound,
} from '../Domain/player.js';

// Service Definition
export class PlayerRepository extends Context.Tag('PlayerRepository')<
  PlayerRepository,
  {
    readonly add: (player: Player) => Effect.Effect<void, PlayerAlreadyExists>;
    readonly remove: (id: PlayerId) => Effect.Effect<void, PlayerNotFound>;
    readonly findById: (id: PlayerId) => Effect.Effect<Player, PlayerNotFound>;
    readonly getAll: Effect.Effect<Player[]>;
  }
>() {}

// Live Implementation
export const PlayerRepositoryLive = Layer.effect(
  PlayerRepository,
  Effect.gen(function* (_) {
    const playersRef = yield* _(Ref.make(HashMap.empty<PlayerId, Player>()));

    const add = (player: Player) =>
      Ref.modify(playersRef, (players) => {
        if (HashMap.has(players, player.id)) {
          return [
            Effect.fail(new PlayerAlreadyExists({ id: player.id })),
            players,
          ] as const;
        }
        return [
          Effect.void as Effect.Effect<void, PlayerAlreadyExists>,
          HashMap.set(players, player.id, player),
        ] as const;
      }).pipe(Effect.flatten);

    const remove = (id: PlayerId) =>
      Ref.modify(playersRef, (players) => {
        if (!HashMap.has(players, id)) {
          return [Effect.fail(new PlayerNotFound({ id })), players] as const;
        }
        return [
          Effect.void as Effect.Effect<void, PlayerNotFound>,
          HashMap.remove(players, id),
        ] as const;
      }).pipe(Effect.flatten);

    const findById = (id: PlayerId) =>
      Ref.get(playersRef).pipe(
        Effect.map((players) => HashMap.get(players, id)),
        Effect.flatMap((option) =>
          option._tag === 'Some'
            ? Effect.succeed(option.value)
            : Effect.fail(new PlayerNotFound({ id }))
        )
      );

    const getAll = Ref.get(playersRef).pipe(
      Effect.map((players) => Array.from(HashMap.values(players)))
    );

    return {
      add,
      remove,
      findById,
      getAll,
    };
  })
);
