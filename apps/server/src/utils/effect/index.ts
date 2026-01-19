import { Effect } from 'effect';

/**
 * Common Effect types and utilities for the application.
 */

// Define a common AppError type if needed, or re-export standard error types
export type AppError = {
  readonly _tag: string;
  readonly message: string;
};

// Helper to run an Effect and log any errors (useful for entry points)
export const runMain = <E, A>(effect: Effect.Effect<A, E>): void => {
  Effect.runPromise(effect).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
};
