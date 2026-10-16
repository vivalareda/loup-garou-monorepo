# AGENTS.md

This is a pnpm + turborepo monorepo for a real-time Werewolf (Loup-Garou) game:
- `apps/server` — Node.js game server over raw WebSockets (`ws`) (plain classes + an in-progress Effect-TS migration)
- `apps/mobile` — React Native + Expo player client (SDK 57)
- `apps/dashboard` — Vite + React testing dashboard with mock players
- `packages/types` — Shared TypeScript types for socket events, players, roles, segments, deaths, plus the WebSocket wire protocol (`src/wire.ts`)
- `packages/realtime` — `@repo/realtime`, the typed WebSocket client every app uses (mobile, dashboard, agent CLI, integration test)

## Workspace commands

| Purpose    | Command                          |
|------------|----------------------------------|
| Install    | `pnpm install`                   |
| Dev (all)  | `pnpm dev`                       |
| Dev server | `pnpm dev:server`                |
| Dev mobile | `pnpm dev:mobile`                |
| Dev dashboard | `pnpm --filter dashboard dev`¹ |
| Typecheck  | `pnpm check-types` (turbo fans out to all packages) |
| Lint       | `pnpm lint`                      |
| Build      | `pnpm build`                     |
| Server tests | `pnpm --filter server test:run` |
| Client tests | `pnpm --filter @repo/realtime test:run` |

> ¹ The root `pnpm dev:web` script (`turbo -F web dev`) filters for a package
> named `web`, which does not exist in this workspace — the dashboard package
> is named `dashboard`. Use `pnpm --filter dashboard dev` until that script is
> fixed.

> NOTE: `pnpm check-types` is wired up — it fans out via turbo to the
> `check-types` script in each package (`server`, `@repo/types`,
> `@repo/realtime`, `dashboard`, `mobile`). This was added by
> `plans/002-fix-check-types-baseline.md`. (The dashboard uses `tsc -b` rather
> than `tsc -b --noEmit` because TS6310 forbids disabling emit on a composite
> project that is referenced; its app config still has `noEmit: true`, so no
> app JS is emitted.)

## Transport: raw WebSockets + JSON

Socket.io is gone from every live path. The pieces:
- Wire protocol (`packages/types/src/wire.ts`): one JSON text frame per
  message — server→client `{ event, args }`, client→server
  `{ event, args, ack? }`, ack reply `{ ack, args }`. Event names are
  checked against the event maps (`isClientEvent` / `isServerEvent`),
  payloads are not.
- Endpoint: `ws(s)://<host>/room/<code>`; clients derive it with
  `roomUrl(baseUrl, code)` from the http(s) base URL env var plus an
  optional room code env var (`EXPO_PUBLIC_ROOM_CODE`,
  `VITE_PUBLIC_ROOM_CODE`, `ROOM_CODE` for the agent CLI; default
  `default`). The Node server hosts a single game and ignores the code.
- Server: `WebSocketHost` (`apps/server/src/server/websocket-host.ts`)
  implements `ConnectionHost` over any socket with `send` / `close` /
  `readyState` / `addEventListener` (the `ws` package's and the Workers
  runtime's both fit) and imports nothing Node-only.
  `websocket-server.ts` attaches it to the Node http server and pings
  every client each 25s, terminating one that missed the previous pong.
- Client: `@repo/realtime` mirrors the Socket.io client API the apps used
  (`on/once/off/onAny/emit`, `connect/disconnect/connected`, reserved
  `connect`/`disconnect`/`connect_error`), reconnects with capped
  exponential backoff + jitter (1s→5s), and queues emits while
  disconnected (flushed before `connect` fires; `disconnect()` drops them).
- `socket.io` stays a server dependency ONLY for the dead Effect files
  below (`index.effect.ts`, `socket-io.effect.ts`,
  `socket-event-router.effect.ts`, `event-handlers.effect.ts`); nothing
  live may import it.

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
- `apps/dashboard`: React 18 + Vite; no test runner (planned via `plans/018`).
