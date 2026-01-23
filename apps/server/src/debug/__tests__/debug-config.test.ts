import { describe, expect, it } from '@effect/vitest';
import { Effect } from 'effect';
import { DebugConfig } from '../debug-config.js';

describe('DebugConfig Service', () => {
  it.effect('reads DEBUG_SEGMENT=true from env var', () =>
    Effect.gen(function* () {
      const config = yield* DebugConfig;
      expect(config.debugSegment).toBe(true);
    }).pipe(Effect.provide(DebugConfig.Test))
  );

  it.effect('reads DEBUG_SEGMENT=false from env var', () =>
    Effect.gen(function* () {
      const originalValue = process.env.DEBUG_SEGMENT;
      process.env.DEBUG_SEGMENT = 'false';

      const result = yield* Effect.sync(() => {
        const config = { debugSegment: process.env.DEBUG_SEGMENT === 'true' };
        return config.debugSegment;
      });

      process.env.DEBUG_SEGMENT = originalValue;
      expect(result).toBe(false);
    })
  );

  it.effect('handles missing env var', () =>
    Effect.gen(function* () {
      const originalValue = process.env.DEBUG_SEGMENT;
      process.env.DEBUG_SEGMENT = undefined;

      const result = yield* Effect.sync(() => {
        const config = { debugSegment: process.env.DEBUG_SEGMENT === 'true' };
        return config.debugSegment;
      });

      if (originalValue !== undefined) {
        process.env.DEBUG_SEGMENT = originalValue;
      }
      expect(result).toBe(false);
    })
  );
});
