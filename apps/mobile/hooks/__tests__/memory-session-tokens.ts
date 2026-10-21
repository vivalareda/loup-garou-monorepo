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
