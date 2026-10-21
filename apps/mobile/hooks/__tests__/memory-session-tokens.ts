import type { SessionTokens } from '@/utils/session';

/** An in-memory `SessionTokens`: the test reads back what the app stored. */
export function createMemorySessionTokens(initial: string | null = null) {
  let stored = initial;

  return {
    get: () => Promise.resolve(stored),
    save: (token: string) => {
      stored = token;

      return Promise.resolve();
    },
    clear: () => {
      stored = null;

      return Promise.resolve();
    },
    stored: () => stored,
  } satisfies SessionTokens & { stored: () => string | null };
}

/**
 * Like `createMemorySessionTokens`, but every read waits until the test
 * calls `finishRead` with the token it finds (oldest read first): lets a
 * test act while a session read is still in flight.
 */
export function createSlowReadSessionTokens() {
  const reads: ((token: string) => void)[] = [];

  return {
    ...createMemorySessionTokens(),
    get: () =>
      new Promise<string | null>((resolve) => {
        reads.push(resolve);
      }),
    finishRead: (token: string) => {
      reads.shift()?.(token);
    },
  } satisfies SessionTokens & { finishRead: (token: string) => void };
}
