import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { Lovers } from '../Lovers.js';

describe('Lovers Service', () => {
  const TestLayer = Lovers.Default;

  it.effect('tracks lover pairs and hunter status', () =>
    Effect.gen(function* () {
      const lovers = yield* Lovers;
      const hunterId = 'hunter-1';
      const partnerId = 'lover-2';
      const otherId = 'villager-3';

      const initialPartner = yield* lovers.getPartner(hunterId);
      expect(initialPartner).toBeNull();
      expect(yield* lovers.isPlayerLover(hunterId)).toBe(false);
      expect(yield* lovers.isAnyOfLoverHunter(hunterId)).toBe(false);

      yield* lovers.setLovers(hunterId, partnerId);

      const hunterPartner = yield* lovers.getPartner(hunterId);
      const partnerPartner = yield* lovers.getPartner(partnerId);

      expect(hunterPartner).toBe(partnerId);
      expect(partnerPartner).toBe(hunterId);
      expect(yield* lovers.isPlayerLover(hunterId)).toBe(true);
      expect(yield* lovers.isPlayerLover(partnerId)).toBe(true);
      expect(yield* lovers.isPlayerLover(otherId)).toBe(false);
      expect(yield* lovers.isAnyOfLoverHunter(hunterId)).toBe(true);
      expect(yield* lovers.isAnyOfLoverHunter(otherId)).toBe(false);
    }).pipe(Effect.provide(TestLayer))
  );
});
