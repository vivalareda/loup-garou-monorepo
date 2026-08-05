# Plan 022: Add `.env.example` for `apps/server` and `apps/dashboard`; add root `AGENTS.md`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server apps/dashboard AGENTS.md .gitignore`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The server reads `process.env.PORT` and `process.env.DEV_FORCE_HUNTER` (= env vars that change game behaviour) with no `.env.example` documenting them. New contributors can't know these exist. The dashboard reads `VITE_PUBLIC_BACKEND_SERVER_URL` (via `apps/dashboard/src/utils/socket.ts:9`) — also no `.env.example`. There's no root `AGENTS.md` describing the dual entry points (`index.ts` vs `index.effect.ts`), the broken `check-types` (= plan 002), or intentional tradeoffs the migration makes — agents touching the repo blind have no map.

## Current state

- `apps/server/src/server/http-server.ts:9` — `const PORT = process.env.PORT || '3000';`
- `apps/server/src/core/game.ts:120` — `const forcedHunterName = process.env.DEV_FORCE_HUNTER;`
- `apps/server/src/segments/audio-manager.ts:196` — `if (process.env.DEBUG_AUDIO) { ... }`
- `apps/dashboard/src/utils/socket.ts:9` — `import.meta.env.VITE_PUBLIC_BACKEND_SERVER_URL` (throw if missing).
- `apps/mobile/.env.example` — exists, documents `EXPO_PUBLIC_BACKEND_SERVER_URL`. Comment reference at `apps/mobile/utils/sockets.ts:5`.
- `apps/server/AGENTS.md` — exists, covers Effect migration; lives at the server level only.
- No root `AGENTS.md` exists.

## Scope

**In scope**:
- `apps/server/.env.example` — create.
- `apps/dashboard/.env.example` — create.
- `AGENTS.md` (root) — create.

**Out of scope**:
- Modifying any existing source code.
- The Effect entry point code or the SegmentsManager port.
- CI workflow.

## Git workflow

- Branch: `advisor/022-env-examples-agents-md`
- Conventional commits — e.g. `docs: add .env.example for server/dashboard and root AGENTS.md`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create `apps/server/.env.example`

```
# HTTP server port (default 3000)
PORT=3000

# Optional: force a specific player to be the HUNTER for testing
# (leave empty in production / normal play)
DEV_FORCE_HUNTER=

# Optional: log audio that would be played instead of playing mp3s.
# Set to 1 to enable. Useful for verifying segment/audio order without
# listening through recorded narration.
DEBUG_AUDIO=
```

Match the style of the existing mobile `.env.example`. Use empty values for the optional vars.

### Step 2: Create `apps/dashboard/.env.example`

```
# Backend Socket.io server URL the dashboard mock players connect to
VITE_PUBLIC_BACKEND_SERVER_URL=http://localhost:3000
```

### Step 3: Create the root `AGENTS.md`

```markdown
# AGENTS.md

This is a pnpm + turborepo monorepo for a real-time Werewolf (Loup-Garou) game:
- `apps/server` — Node.js + Socket.io game server (plain classes + an in-progress Effect-TS migration)
- `apps/mobile` — React Native + Expo player client (SDK 57)
- `apps/dashboard` — Vite + React testing dashboard with mock players
- `packages/types` — Shared TypeScript types for socket events, players, roles, segments, deaths

## Workspace commands

| Purpose    | Command                          |
|------------|----------------------------------|
| Install    | `pnpm install`                   |
| Dev (all)  | `pnpm dev`                       |
| Dev server | `pnpm dev:server`                |
| Dev mobile | `pnpm dev:mobile`                |
| Dev dashboard | `pnpm dev:dashboard`         |
| Typecheck  | `pnpm check-types` (turbo fans out) |
| Lint       | `pnpm lint`                      |
| Build      | `pnpm build`                     |
| Server tests | `pnpm --filter server test:run` |

> NOTE: As of this commit, `pnpm check-types` is a silent no-op because the
> root turbo task has no matching `check-types` script in any package. Plan
> `plans/002-fix-check-types-baseline.md` fixes this; until then, use
> `pnpm --filter server typecheck`, `npx tsc --noEmit -p apps/mobile/tsconfig.json`,
> `npx tsc --noEmit -p apps/dashboard/tsconfig.json`.

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
```

### Step 4: Confirm files exist

**Verify**: `ls apps/server/.env.example apps/dashboard/.env.example AGENTS.md` shows all three.

## Test plan

- No automated tests — these are doc files. The done criteria greps are the gate.

## Done criteria

ALL must hold:

- [ ] `ls apps/server/.env.example` exists
- [ ] `ls apps/dashboard/.env.example` exists
- [ ] `ls AGENTS.md` exists
- [ ] `grep -n "DEV_FORCE_HUNTER" apps/server/.env.example` returns a match
- [ ] `grep -n "DEBUG_AUDIO" apps/server/.env.example` returns a match
- [ ] `grep -n "PORT" apps/server/.env.example` returns a match
- [ ] `grep -n "VITE_PUBLIC_BACKEND_SERVER_URL" apps/dashboard/.env.example` returns a match
- [ ] `grep -n "AGENTS.md" AGENTS.md` returns a match (it exists and has its own header)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- An existing `.env.example` at `apps/server` or `apps/dashboard` is found (someone already added one — STOP, harmonize, don't overwrite).
- The root `AGENTS.md` exists already — STOP, merge — don't overwrite.
- The server actually reads additional env vars beyond PORT/DEV_FORCE_HUNTER/DEBUG_AUDIO that I missed (e.g. a `HOST` setting from `http-server.effect.ts`) — read `apps/server/src/server/http-server.effect.ts` and confirm; if so, add to `.env.example` for parity.

## Maintenance notes

- New env vars added to the server (e.g. `HUNTER_PICK_TIMEOUT_SECONDS` from plan 009) should update `apps/server/.env.example` in the same commit.
- When the Effect migration completes (= `index.effect.ts` becomes `dev`), update the root `AGENTS.md` to drop the "dual entry points" note. Let `AGENTS.md` be the single source of truth for entry-point state.
- If CI lands, replace the broken-check-types note with the real working command once plan 002 lands.