# Plan 023: Restrict Socket.io CORS from `origin: '*'` with `credentials: true`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/sockets.ts apps/server/.env.example`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (dev environments remain reachable via allowlist; root remains explicit)
- **Depends on**: plan 022 (`.env.example` for the new env var — coordinate)
- **Category**: security
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`apps/server/src/server/sockets.ts:7-13` initializes Socket.io with:

```ts
cors: {
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['*'],
  credentials: true,
},
```

Socket.io reflects the requester's origin when `origin: '*'` is combined with `credentials: true`. Any web origin can open a credentialed WebSocket to the game server. Combined with the missing server-side role validation (= plan 006), a malicious page can join games and fire cupid / witch / hunter events from a visitor's browser. This is a public WebSocket endpoint with no authentication and the broadest possible cross-origin policy.

## Current state

- `apps/server/src/server/sockets.ts` — full file (~18 lines). The line `origin: '*'` is line 9.
- `apps/server/src/server/http-server.ts` — small fileserver, unrelated to CORS.
- No auth/session mechanism exists — the server treats socket ID as identity.

### Repo conventions to follow

- The server already reads `process.env` for env vars (`PORT`, `DEV_FORCE_HUNTER`, `DEBUG_AUDIO`). Read allowed origins from `process.env.CORS_ORIGIN` (comma-list) with a sensible localhost default.
- Don't introduce Helmet or cookie-session — out of scope (only socket.io CORS).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all 56 pass         |

## Scope

**In scope**:
- `apps/server/src/server/sockets.ts` — replace `origin: '*'` with an allowlist read from env (`CORS_ORIGIN`, defaulting to common dev origins); set `credentials: false` (the game uses no cookie-based auth — socket ID is identity).
- `apps/server/.env.example` — document `CORS_ORIGIN` (coordinate with plan 022 if not landed).

**Out of scope**:
- Adding auth (no plans for sessions; out of scope).
- The HTTP server (`http-server.ts`) — it has no CORS config; leave it.
- The mobile client's connection (`apps/mobile/utils/sockets.ts`) — unaffected; mobile uses `socket.io-client` with explicit URL.
- Dashboard's connection (`apps/dashboard/src/utils/socket.ts`) — unaffected; dashboard connects to localhost:3000 in dev.

## Git workflow

- Branch: `advisor/023-restrict-socket-cors`
- Conventional commits — e.g. `fix: restrict Socket.io CORS to an env-driven allowlist`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `CORS_ORIGIN` to `apps/server/.env.example`

If plan 022 has landed, append to `apps/server/.env.example`:

```
# Comma-separated list of allowed Socket.io origins.
# Defaults to localhost dev origins if unset.
# Example for production: https://loup-garou.example.com
CORS_ORIGIN=http://localhost:5173,http://localhost:8081,exp://localhost:8081
```

If plan 022 hasn't landed, create `apps/server/.env.example` per plan 022's spec (including `CORS_ORIGIN`) — coordinate by reading this plan's section in plan 022.

**Verify**: `grep -n "CORS_ORIGIN" apps/server/.env.example` returns one match.

### Step 2: Replace `origin: '*'` with an allowlist + disable credentials

Rewrite `apps/server/src/server/sockets.ts` to:

```ts
import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
import { Server } from 'socket.io';
import { httpServer } from './http-server';

export type SocketType = typeof io;

function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    // Dev defaults: Vite dashboard, Metro bundler, Expo dev client
    return [
      'http://localhost:5173',
      'http://localhost:8081',
      'exp://localhost:8081',
    ];
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: getAllowedOrigins(),
    methods: ['GET', 'POST'],
    credentials: false,
  },
  pingTimeout: 60_000,
  pingInterval: 25_000,
});

export { io };
```

Notes:
- Drop `allowedHeaders: ['*']` — not needed with `credentials: false` and a named-method allowlist; keeping it open is unnecessary.
- Computing `getAllowedOrigins()` once at module load is fine — env doesn't change after process start; if hot-reload of origins is wanted later, that's a feature plan.
- The mobile client (Expo) uses `exp://...` or `http://localhost:8081` for the bundler WS — included in the default allowlist so local dev still works without env changes.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Tests sanity

**Verify**: `pnpm --filter server test:run` → all 56 pass (no test depends on the CORS config; tests construct `Game` with a mock `io`, not the real socket.io server).

### Step 4: Manual smoke (optional — record in NOTES)

If feasible, start the server (`pnpm dev:server`) and confirm:
- Dashboard at `http://localhost:5173` still connects (default allowlist).
- A curl from `Origin: http://example.com` to the Socket.io handshake endpoint is rejected with a CORS error.

(Either confirm or note that this requires a runtime smoke OK skip.)

## Test plan

- No new automated tests here — CORS config is integration-level and depends on real Socket.io handshake; a unit test would just restate the env list. If plan 006's role-validation integration suite shapes up, a CORS rejection test belongs there; for now, code-read + typecheck.

## Done criteria

ALL must hold:

- [ ] `grep -n "origin: '\*'" apps/server/src/server/sockets.ts` returns no matches
- [ ] `grep -n "credentials: true" apps/server/src/server/sockets.ts` returns no matches
- [ ] `grep -n "credentials: false" apps/server/src/server/sockets.ts` returns a match
- [ ] `grep -n "getAllowedOrigins\|CORS_ORIGIN" apps/server/src/server/sockets.ts` returns matches (env-driven allowlist is wired)
- [ ] `grep -n "CORS_ORIGIN" apps/server/.env.example` returns a match
- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- An existing test asserts `origin: '*'` or `credentials: true` directly (would fail after the change). Report the test — likely the test itself is the bad actor and should be updated to assert the new shape. Don't keep the open CORS for a test.
- The dashboard was previously relying on `credentials: true` for a cookie-based behavior — confirm by reading the dashboard's socket setup; if there's anything reading cookies/sessions on socket events, STOP — that's a different plan's scope.
- Mobile Expo dev client uses an origin other than the three in the default list (e.g. on Android emulator, the host could be `10.0.2.2:8081`) — the user can add it via `CORS_ORIGIN`, but report any dev-local origin you had to add so the default list can stay representative.
- Plan 022 hasn't landed and you'd be creating `apps/server/.env.example` from scratch — STOP and confirm whether to (a) inline the `CORS_ORIGIN` line into the minimal `.env.example` this plan would create or (b) wait for plan 022 first.

## Maintenance notes

- When the game ships to a public domain, set `CORS_ORIGIN` to that production origin via whatever deploy mechanism manages env (e.g. a `.env.production` or secret manager).
- If a future plan adds auth (cookies / Bearer tokens via `extraHeaders`), evaluate reintroducing `credentials: true` ALONGSIDE a tightened `origin` allowlist — never bring back `origin: '*'` + `credentials: true`.
- Mobile React Native's `socket.io-client` connects via `exp://` or `http://` origin in dev; production mobile builds may use a custom scheme — add to the `CORS_ORIGIN` allowlist at that point. The Socket.io handshake reads the `Origin` header, so any HTTPS-served web build (e.g. a deployed dashboard at `https://dashboard.lgcgame.com`) must be listed.