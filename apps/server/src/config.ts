const DEFAULT_PLAYER_COUNT = 6;
const MIN_PLAYER_COUNT = 4;

/**
 * Number of players a game needs before it auto-starts. Read from the
 * PLAYER_COUNT env var (default 6). Called at server startup so an invalid
 * value crashes the process immediately with a clear error instead of
 * silently never starting a game.
 */
export function resolvePlayerCount(
  rawValue: string | undefined = process.env.PLAYER_COUNT
): number {
  if (rawValue === undefined || rawValue === '') {
    return DEFAULT_PLAYER_COUNT;
  }

  const count = Number(rawValue);
  if (!Number.isInteger(count) || count < MIN_PLAYER_COUNT) {
    throw new Error(
      `Invalid PLAYER_COUNT "${rawValue}": must be an integer >= ${MIN_PLAYER_COUNT}`
    );
  }

  return count;
}
