# worker

The game on Cloudflare Workers. One Worker serves everything from a single
origin:

- `GET /room/<code>` (WebSocket upgrade) goes to that room's `GameRoom`
  Durable Object. Codes are 1-64 letters, digits, `-` or `_` (what
  `roomUrl` accepts) and are upper-cased, so `abc` and `ABC` are the same
  room. A bad code gets a 400, a plain request a 426.
- Every other path is the built dashboard (`apps/dashboard/dist-worker`,
  built by `pnpm --filter dashboard build:worker`), including the
  narration clips under `/audio/*.mp3`.

The Durable Object builds one game with `createGameRuntime`
(`apps/server/src/game-runtime.ts`, the same wiring as the Node entry) on
a `WebSocketHost` and a `DashboardNarrator`. The game code is bundled
straight from `apps/server/src` through the `@/*` path in `tsconfig.json`.

## Local development

```sh
pnpm dev:worker                # builds the dashboard, then wrangler dev on :8787
pnpm --filter worker test:run  # Workers-runtime tests, offline
pnpm --filter worker check-types
```

Open http://localhost:8787, click "Play narration here" in a tab to make it
the narrator, then join with the mobile app (`EXPO_PUBLIC_BACKEND_SERVER_URL`
= the Worker's URL, see `apps/mobile/.env.example`), mock players or the
agent CLI (`SERVER_URL=http://localhost:8787 pnpm --filter server agent Ana`).

Game config comes from `vars` in `wrangler.jsonc` (read through
`process.env`, with the Node defaults). For a short test game, override
them per run or in a git-ignored `.dev.vars`:

```sh
pnpm --filter worker dev --var PLAYER_COUNT:4 --var SEGMENT_TIMEOUT_MS:5000
```

Run `pnpm --filter worker cf-typegen` after changing `wrangler.jsonc`; it
regenerates `worker-configuration.d.ts`. Hot reload drops the open sockets
(clients reconnect into a fresh game).

## Deploying (later)

Nothing has been deployed yet. With a Cloudflare account:

```sh
pnpm --filter worker exec wrangler login
pnpm --filter worker deploy    # builds the dashboard, then wrangler deploy
```

It prints the `https://loup-garou.<account>.workers.dev` URL to put in the
mobile app's `EXPO_PUBLIC_BACKEND_SERVER_URL`. `pnpm --filter worker build`
does a `wrangler deploy --dry-run` into `dist/` to check the bundle without
an account.

## Things to know

- **No hibernation.** Sockets use `accept()`, not the hibernation API: the
  game's timers keep the object awake anyway, and hibernating would lose
  the in-memory game. A room is evicted after it has had no sockets and no
  timers for a while.
- **Nothing is persisted.** A deploy (or an eviction) resets every live
  game; clients reconnect and are sent back to the join screen.
- **The narrator is a dashboard tab.** There are no speakers on Workers:
  the clips play in the tab that clicked "Play narration here" for that
  room. With none, clips are skipped. The dashboard joins the room of its
  build-time `VITE_PUBLIC_ROOM_CODE` (default `default`).
