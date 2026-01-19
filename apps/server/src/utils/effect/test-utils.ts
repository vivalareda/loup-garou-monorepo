import { expect } from '@effect/vitest';
import { Effect, Exit } from 'effect';

/**
 * Runs an effect and asserts that it succeeds with the expected value.
 */
export const assertSuccess = async <A, E>(
  effect: Effect.Effect<A, E>,
  expected?: A
) => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isFailure(exit)) {
    throw new Error(
      `Expected success but failed with: ${JSON.stringify(exit.cause)}`
    );
  }
  if (expected !== undefined) {
    expect(exit.value).toEqual(expected);
  }
  return exit.value;
};

/**
 * Runs an effect and asserts that it fails.
 */
export const assertFailure = async <A, E>(effect: Effect.Effect<A, E>) => {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    throw new Error(
      `Expected failure but succeeded with: ${JSON.stringify(exit.value)}`
    );
  }
  return exit.cause;
};
