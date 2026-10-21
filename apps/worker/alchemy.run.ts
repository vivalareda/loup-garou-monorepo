import * as Alchemy from 'alchemy';
import * as Cloudflare from 'alchemy/Cloudflare';
import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Record from 'effect/Record';
import * as Redacted from 'effect/Redacted';
import { compatibilityDate, vars } from './settings';
import type { GameRoom } from './src/game-room';

/**
 * A var's committed value, which only `alchemy dev` lets the shell or
 * `.env` override (e.g. SEGMENT_TIMEOUT_MS=5000 for a short test game).
 * A deploy always binds the committed value, so a stray
 * ENABLE_ADMIN_EVENTS=true in the deploying shell never goes live.
 */
const devOverridable = (value: string, name: string) =>
  Config.all({
    dev: Alchemy.ALCHEMY_DEV,
    local: Config.String(name).pipe(Config.withDefault(value)),
  }).pipe(Config.map(({ dev, local }) => (dev ? local : value)));

export const Worker = Cloudflare.Worker('Worker', {
  // Pinned (Alchemy would add the stage and a random suffix): the URL
  // clients are built with stays https://loup-garou.<account>.workers.dev,
  // and lost local state is recovered with `--adopt` by this name
  name: 'loup-garou',
  main: './src/index.ts',
  compatibility: { date: compatibilityDate },
  env: {
    ...Record.map(vars, devOverridable),
    // One GameRoom per room code; each holds its game in memory only.
    // New classes are SQLite-backed
    GAME_ROOM: Cloudflare.DurableObject<GameRoom>('GameRoom'),
    // Optional secret, read from the deploying shell or .env: set, it
    // requires ?token= on /room/* and /rooms; unset (empty), they are open
    ACCESS_TOKEN: Config.Redacted('ACCESS_TOKEN').pipe(
      Config.withDefault(Redacted.make(''))
    ),
  },
  // The built dashboard, same origin as the game. Only the game's paths
  // (/room/* sockets, the /rooms API) run the Worker; every other path is
  // a static file or the SPA's index.html
  assets: {
    directory: '../dashboard/dist-worker',
    notFoundHandling: 'single-page-application',
    runWorkerFirst: ['/room/*', '/rooms', '/rooms/*'],
  },
  observability: { enabled: true },
  // `DEV_HOST=0.0.0.0` (shell only) lets phones on the LAN reach it
  dev: { port: 8787, host: process.env.DEV_HOST ?? 'localhost' },
});

export type WorkerEnv = Cloudflare.InferEnv<typeof Worker>;

export default Alchemy.Stack(
  'loup-garou',
  // State on disk in .alchemy/ (git-ignored): local dev needs no account.
  // Shared deploys (CI, a second machine) want Cloudflare.state() instead
  { providers: Cloudflare.providers(), state: Alchemy.localState() },
  Effect.gen(function* () {
    const worker = yield* Worker;

    return { url: worker.url };
  })
);
