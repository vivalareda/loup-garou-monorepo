/**
 * The Worker's runtime and game config, shared by `alchemy.run.ts`
 * (deploys and `alchemy dev`) and `vitest.config.ts` (the Workers-runtime
 * tests), so the tests run on the same runtime as the deployed Worker.
 */

/**
 * Must not be newer than the installed workerd supports. nodejs_compat
 * (node:crypto in core/player.ts, process.env filled from the vars) is on
 * by default from 2026-08-04, and workerd rejects it as a redundant flag.
 */
export const compatibilityDate = '2026-08-15';

/**
 * Game config, read through process.env like on Node (same defaults).
 * `alchemy dev` lets the shell or `.env` override any of them; a deploy
 * always binds these values.
 * - PLAYER_COUNT: the count a new room's game starts at; its host can
 *   change it in the lobby (4-16).
 * - ENABLE_ADMIN_EVENTS: "true" turns on the dashboard's admin:* testing
 *   tools, which let any client drive the game (local testing only).
 * - MAX_CONNECTIONS_PER_ROOM: further upgrades get a 503.
 * - SEGMENT_TIMEOUT_MS: empty, so each segment keeps its own deadline;
 *   set, it overrides them all (short test games). The per-segment vars
 *   (WEREWOLF_TIMEOUT_MS, ...) are left out: they would shadow it.
 * ACCESS_TOKEN is not here: it is a secret, see `alchemy.run.ts`.
 */
export const vars = {
  PLAYER_COUNT: '6',
  DISCONNECT_GRACE_MS: '90000',
  DAY_DISCUSSION_MS: '120000',
  ENABLE_ADMIN_EVENTS: 'false',
  MAX_CONNECTIONS_PER_ROOM: '32',
  SEGMENT_TIMEOUT_MS: '',
};
