# worker

The game on Cloudflare Workers. One Worker serves everything from a single
origin:

- `GET /room/<code>` (WebSocket upgrade) goes to that room's `GameRoom`
  Durable Object. Codes are 1-64 letters, digits, `-` or `_` (what
  `roomUrl` accepts) and are upper-cased, so `abc` and `ABC` are the same
  room. A bad code gets a 400, a plain request a 426, a missing or wrong
  access token (when one is set) a 401, and a full room a 503.
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
agent CLI (`SERVER_URL=http://localhost:8787 pnpm --filter server agent Ana`). The
dashboard's game controls (Start Game, Next Segment, mock scenarios) are
`admin:*` events, ignored unless `ENABLE_ADMIN_EVENTS` is `"true"`.

Game config comes from `vars` in `wrangler.jsonc` (read through
`process.env`, with the Node defaults). For a short test game, override
them per run or in a git-ignored `.dev.vars`:

```sh
pnpm --filter worker dev --var PLAYER_COUNT:4 --var SEGMENT_TIMEOUT_MS:5000 \
  --var ENABLE_ADMIN_EVENTS:true
```

Worker-only vars:

| Var | Default | Effect |
|-----|---------|--------|
| `ENABLE_ADMIN_EVENTS` | `"false"` | `"true"` registers the dashboard's `admin:*` / `admin:mock-*` testing tools. They let any client advance phases, inject players or change deaths, so keep them off outside local testing; off, those events are ignored. |
| `MAX_CONNECTIONS_PER_ROOM` | `"32"` | Upgrades beyond this many open sockets in one room get a 503 (players, dashboard tabs and mock players all count). |
| `ACCESS_TOKEN` | unset | When set (`wrangler secret put ACCESS_TOKEN`, or `--var` locally), `/room/<code>` needs `?token=<value>` and answers 401 otherwise, before any Durable Object is created. Unset, rooms are open. |

Clients append the token from `EXPO_PUBLIC_ACCESS_TOKEN` (mobile),
`VITE_PUBLIC_ACCESS_TOKEN` (dashboard, at build time) or `ACCESS_TOKEN`
(agent CLI). A token compiled into the app or the dashboard bundle is a
speed bump against random scanners, not authentication: anyone with a
client build has it.

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
mobile app's `EXPO_PUBLIC_BACKEND_SERVER_URL`. To check the bundle without
an account, `pnpm turbo run build --filter=worker` builds the dashboard
(`dashboard#build:worker`) and then does a `wrangler deploy --dry-run`
into `dist/`.

### Before a public deploy

The token and the connection cap only keep casual traffic out. Before
sharing the URL beyond friends:

- Rate-limit `/room/*`: a Cloudflare rate-limiting rule, or the
  `ratelimit` binding checked in the Worker before the Durable Object.
- Real authentication or per-game invites instead of one shared token.
- Origin checks for browser clients (the dashboard), so other sites
  can't open sockets from their visitors' browsers.
- Known limitation: a reset (`game:restart` after a finished game, or a
  room emptied) does not cancel work in flight, so a narration clip
  still playing when it happens can resume against the new game (see
  `reset` in `apps/server/src/game-runtime.ts`).

## Things to know

- **No hibernation.** Sockets use `accept()`, not the hibernation API: the
  game's timers keep the object awake anyway, and hibernating would lose
  the in-memory game. A finished game clears its deadlines, and when the
  last socket leaves a lobby or a finished game the room resets itself,
  so the object can be evicted. A game in progress is kept (players have
  the 90s reconnect grace), and its timers keep the object awake.
- **Nothing is persisted.** A deploy (or an eviction) resets every live
  game; clients reconnect and are sent back to the join screen.
- **The narrator is a dashboard tab.** There are no speakers on Workers:
  the clips play in the tab that clicked "Play narration here" for that
  room. With none, clips are skipped. The dashboard joins the room of its
  build-time `VITE_PUBLIC_ROOM_CODE` (default `default`).
