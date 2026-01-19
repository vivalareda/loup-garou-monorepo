import { describe, it } from '@effect/vitest';
import { Effect } from 'effect';
import { assertFailure, assertSuccess } from '../test-utils';

describe('Effect Setup', () => {
  it('should run a simple effect', async () => {
    const program = Effect.succeed(42);
    await assertSuccess(program, 42);
  });

  it('should handle failures', async () => {
    const program = Effect.fail('error');
    await assertFailure(program);
  });

  it('should integrate with vitest', () => {
    Effect.runSync(Effect.log('Effect is working!'));
  });
});
