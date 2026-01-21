import { Effect } from 'effect';

export class Lovers extends Effect.Service<Lovers>()('@app/Lovers', {
  effect: Effect.gen(function* () {
    const lovers = new Map<string, string>();

    return {
      setLovers: (firstPlayerId: string, secondPlayerId: string) =>
        Effect.sync(() => {
          lovers.set(firstPlayerId, secondPlayerId);
          lovers.set(secondPlayerId, firstPlayerId);
        }),
      getPartner: (playerId: string) =>
        Effect.sync(() => lovers.get(playerId) ?? null),
      isPlayerLover: (playerId: string) =>
        Effect.sync(() => lovers.has(playerId)),
      isAnyOfLoverHunter: (hunterId: string) =>
        Effect.sync(() => lovers.has(hunterId)),
    };
  }),
}) {}
