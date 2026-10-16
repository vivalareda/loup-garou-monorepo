# AGENTS.md

This is a pnpm + turborepo monorepo for a real-time Werewolf (Loup-Garou) game:
- `apps/server` — Node.js game server over raw WebSockets (`ws`) (plain classes + an in-progress Effect-TS migration)
- `apps/mobile` — React Native + Expo player client (SDK 57)
- `apps/dashboard` — Vite + React testing dashboard with mock players
- `apps/worker` — the game on Cloudflare Workers: one `GameRoom` Durable Object per room code, plus the built dashboard as static assets (see `apps/worker/README.md`)
- `packages/types` — Shared TypeScript types for socket events, players, roles, segments, deaths, plus the WebSocket wire protocol (`src/wire.ts`)
- `packages/realtime` — `@repo/realtime`, the typed WebSocket client every app uses (mobile, dashboard, agent CLI, integration test)

## Workspace commands

| Purpose    | Command                          |
|------------|----------------------------------|
| Install    | `pnpm install`                   |
| Dev (all)  | `pnpm dev`                       |
| Dev server | `pnpm dev:server`                |
| Dev worker | `pnpm dev:worker` (builds the dashboard, `wrangler dev` on :8787) |
| Dev mobile | `pnpm dev:mobile`                |
| Dev dashboard | `pnpm --filter dashboard dev`¹ |
| Typecheck  | `pnpm check-types` (turbo fans out to all packages) |
| Lint       | `pnpm lint`                      |
| Build      | `pnpm build`                     |
| Server tests | `pnpm --filter server test:run` |
| Client tests | `pnpm --filter @repo/realtime test:run` |
| Worker tests | `pnpm --filter worker test:run` |
| Worker bundle check | `pnpm turbo run build --filter=worker` (dashboard, then `wrangler deploy --dry-run`) |

> ¹ The root `pnpm dev:web` script (`turbo -F web dev`) filters for a package
> named `web`, which does not exist in this workspace — the dashboard package
> is named `dashboard`. Use `pnpm --filter dashboard dev` until that script is
> fixed.

> NOTE: `pnpm check-types` is wired up — it fans out via turbo to the
> `check-types` script in each package (`server`, `@repo/types`,
> `@repo/realtime`, `dashboard`, `mobile`, `worker`). This was added by
> `plans/002-fix-check-types-baseline.md`. (The dashboard uses `tsc -b` rather
> than `tsc -b --noEmit` because TS6310 forbids disabling emit on a composite
> project that is referenced; its app config still has `noEmit: true`, so no
> app JS is emitted.)

## Transport: raw WebSockets + JSON

Socket.io is gone from every live path. The pieces:
- Wire protocol (`packages/types/src/wire.ts`): one JSON text frame per
  message — server→client `{ event, args }`, client→server
  `{ event, args, ack? }`, ack reply `{ ack, args }`, and the heartbeat
  `{ ping: n }` → `{ pong: n }`. Event names are checked against the
  event maps (`isClientEvent` / `isServerEvent`), payloads are not.
- Endpoint: `ws(s)://<host>/room/<code>`; clients derive it with
  `roomUrl(baseUrl, code)` from the http(s) base URL env var plus an
  optional room code env var (`EXPO_PUBLIC_ROOM_CODE`,
  `VITE_PUBLIC_ROOM_CODE`, `ROOM_CODE` for the agent CLI; default
  `default`). The Node server hosts a single game and ignores the code;
  the Worker runs one game per (upper-cased) code.
- Server: `WebSocketHost` (`apps/server/src/server/websocket-host.ts`)
  implements `ConnectionHost` over any socket with `send` / `close` /
  `readyState` / `addEventListener` (the `ws` package's and the Workers
  runtime's both fit) and imports nothing Node-only. It answers pings,
  closes a connection silent for 45s (`idleTimeoutMs`) and one sending a
  frame over 64 KiB (`maxFrameBytes`, close code 1009).
  `websocket-server.ts` attaches it to the Node http server (`ws`
  `maxPayload` = the host's limit, no protocol-level pings: liveness is
  the app-level heartbeat only, the same as in a Durable Object).
- Client: `@repo/realtime` mirrors the Socket.io client API the apps used
  (`on/once/off/onAny/emit`, `connect/disconnect/connected`, reserved
  `connect`/`disconnect`/`connect_error`), reconnects with capped
  exponential backoff + jitter (1s→5s), pings every 20s and abandons the
  socket when a pong is 10s late or a handshake takes over 10s. Emits
  made while not connected are dropped (`emit` returns false) since the
  rejoin snapshot restores the state; anything a new connection needs is
  re-sent from a `connect` listener (mobile `player:rejoin`, dashboard
  `narrator:register`). The only exception is the per-client
  `bufferBeforeConnect` allowlist, queued before the FIRST connection
  only: mobile lists `player:join` and `lobby:get-players-list`; the
  dashboard and agent CLI list nothing. Never allowlist `admin:*`, game
  actions or `narrator:done`.
- `socket.io` stays a server dependency ONLY for the dead Effect files
  below (`index.effect.ts`, `socket-io.effect.ts`,
  `socket-event-router.effect.ts`, `event-handlers.effect.ts`); nothing
  live may import it.

## Cloudflare Workers (`apps/worker`)

- Both entries build the game with `createGameRuntime({ host, narrator })`
  (`apps/server/src/game-runtime.ts`): the Node `index.ts` with the `ws`
  host and `LocalNarrator` (or `DashboardNarrator` with
  `NARRATOR=dashboard`), the `GameRoom` Durable Object with a
  `WebSocketHost` and always a `DashboardNarrator`. Wire new game objects
  there, not in an entry.
- The Worker bundles `apps/server/src` through the `@/*` tsconfig path.
  Keep Node-only modules out of what `game-runtime.ts` imports: they
  crash the Worker at load (`server/local-narrator.ts`, `sockets.ts`,
  `http-server.ts`, `websocket-server.ts`, `index.ts`, `index.effect.ts`).
  `node:crypto` is fine under `nodejs_compat`.
- Config is the same env vars, from `vars` in `wrangler.jsonc` (read
  through `process.env`); override per run with `--var` or `.dev.vars`.
- Admission: `createGameRuntime` takes `adminEvents`. Node passes `true`
  (testing rig); the Worker only when `ENABLE_ADMIN_EVENTS` is `"true"`
  (default `"false"`), otherwise `admin:*` events are not even
  registered. `MAX_CONNECTIONS_PER_ROOM` (default 32) caps sockets per
  room (503), and an optional `ACCESS_TOKEN` secret requires
  `?token=` on `/room/*` (401). The token is a speed bump, not auth;
  rate limiting and real auth are listed in the worker README's "Before
  a public deploy".
- Async game code must survive a reset: `SegmentsManager` bumps a game
  generation on finish and reset, and anything that awaits (narration,
  a hunter pick) or fires later captures it first and stops if it
  changed (`server/stale-game.ts` for the Effect resolutions).
  `advanceSegment` ends each segment once; repeated finishes are no-ops.
- A finished game clears its deadlines, and the room resets when its
  last socket leaves a lobby or a finished game, so the Durable Object
  can be evicted; a game in progress is kept for the reconnect grace.
- No hibernation: sockets use `server.accept()`, since the game's timers
  keep the object awake anyway and hibernating would lose the in-memory
  game. Nothing is persisted, so a deploy (or eviction) resets every live
  game.
- `worker#build` depends on `dashboard#build:worker` in turbo.json, so
  `pnpm turbo run build --filter=worker` rebuilds and caches `dist-worker`.
- The narrator is the dashboard tab that clicked "Play narration here";
  the Worker serves the dashboard (`apps/dashboard/dist-worker`, built by
  `pnpm --filter dashboard build:worker`) and its `/audio/*.mp3` clips
  from the same origin, so the dashboard's backend URL is left unset.
- Tests run inside workerd with `@cloudflare/vitest-plugin` and the
  worker's own vitest 4 (the rest of the repo is on vitest 3).
- Never `wrangler deploy` / `wrangler login` from an agent session; the
  user deploys (`pnpm --filter worker deploy`).

## Server: dual entry points (Effect migration)

The server runs from `apps/server/src/index.ts` (the dev script in
`apps/server/package.json` uses `tsx --watch src/index.ts`). A parallel
Effect entry point at `apps/server/src/index.effect.ts` exists but is not
wired to the `dev` script yet — it logs "Game restart not yet implemented
in Effect version".

The migration to Effect exists for three reasons (documented in `PLAN.md`):
1. Pausing segment execution while waiting on player input (`Deferred`).
2. DI via layers for testing.
3. Typed errors.

`night-dawn-resolution.ts` and `day-vote-resolution.ts` are the linear Effect programs that use the Deferred pattern; `segments-manager.ts` still runs the live loop in plain classes — porting it is parked.

While the migration is in progress:
- `.effect.ts` files are DI wrappers; the `pendingHunterPick` Deferred is implemented in the two resolution files; the segment-level port is parked.
- `socket-event-router.effect.ts` and `event-handlers.effect.ts` are dead (not imported by the live entry) — they are the intended future home of the socket handlers; do NOT assume they behave the same as `server-events.ts` — the two have drifted (e.g. LoversAlertCount Ref vs local counter).

## Intentional tradeoffs (NOT bugs)

- The nobody-dies tie rule in `Game.getDayVoteResult()` is a deliberate placeholder pending mobile UI for revote.
- Admin/mock events (`admin:*`, `admin:mock-*`) in `server-events.ts` are testing tools for the dashboard.
- SEER and HUNTER roles are commented out in `Game.initRolesList()` intentionally (incomplete features).
- The `@deprecated alertPlayerOfDeath` in `game.ts` is removed by `plans/015-delete-dead-game-methods.md` (if not yet landed, see that plan).

## Conventions

- Strict TS mode is not enforced workspace-wide (root `tsconfig.json` only sets `strictNullChecks`). Plans to add `tsconfig.base.json` with `strict: true` are tracked in `plans/`.
- Biome + ultracite handle formatting (`biome.jsonc` at root); lint-staged runs `ultracite format` on staged files.
- Socket events live in `packages/types/src/event.ts` (`ClientToServerEvents`, `ServerToClientEvents`). Adding a new event requires editing that file.

## Per-package quirks

- `apps/server`: `effect-tsgo patch` runs on `prepare` — patches the installed TypeScript LSP for Effect's IDE support. Don't disable.
- `apps/mobile`: Expo SDK 57 pins TypeScript ~6.0.3 — out of step with the server's `^7.0.2`. Plans to align are in `plans/`.
- `apps/dashboard`: React 18 + Vite; no test runner (planned via `plans/018`). `VITE_PUBLIC_BACKEND_SERVER_URL` is optional: unset, it uses the page's origin (how the Worker serves it; `build:worker` uses `.env.worker` to force that).
- `apps/worker`: `worker-configuration.d.ts` is generated by `pnpm --filter worker cf-typegen` (rerun after editing `wrangler.jsonc`); `compatibility_date` can't be newer than the installed workerd supports.
