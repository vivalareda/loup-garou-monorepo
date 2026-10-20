import {
  isValidPlayerCount,
  MAX_PLAYER_COUNT,
  MIN_PLAYER_COUNT,
} from '@repo/types';

const DEFAULT_PLAYER_COUNT = 6;

/**
 * Number of players a new room's game starts at, until its host changes
 * it (`lobby:set-player-count`). Read from the PLAYER_COUNT env var
 * (default 6). Called at server startup so an invalid value crashes the
 * process immediately with a clear error instead of silently never
 * starting a game.
 */
export function resolvePlayerCount(
  rawValue: string | undefined = process.env.PLAYER_COUNT
): number {
  if (rawValue === undefined || rawValue === '') {
    return DEFAULT_PLAYER_COUNT;
  }

  const count = Number(rawValue);
  if (!isValidPlayerCount(count)) {
    throw new Error(
      `Invalid PLAYER_COUNT "${rawValue}": must be an integer from ${MIN_PLAYER_COUNT} to ${MAX_PLAYER_COUNT}`
    );
  }

  return count;
}
