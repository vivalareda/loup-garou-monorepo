# Plan 013: Reconcile duplicate `GameState` Context.Tag definitions so the Effect path isn't a landmine

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/index.effect.ts apps/server/src/server/game-service.effect.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (the Effect entry is not the active dev path; this is dead/parallel code)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

There are **two** `GameState` Context.Tag definitions in the server:

1. `apps/server/src/index.effect.ts:40-52` — exported `GameState` Tag, plus local `resetLoversAlertCount` / `incrementLoversAlertCount` / `getLoversAlertCount` (lines 114-128) and the `makeGameState` helper (lines 71-103).
2. `apps/server/src/server/game-service.effect.ts:12-23` — a **different** `GameState` Tag with different object identity, plus its own `makeGameState` (lines 28-48), `makeGameStateLayer` (53-71), `resetLoversAlertCount` (76-79), `incrementLoversAlertCount` (84-88), `getLoversAlertCount` (93-96).

Effect's `Context.Tag` identity is by **object reference**, not by the string key. The router/handlers at `socket-event-router.effect.ts:5` and `event-handlers.effect.ts:4` import `GameState` from `game-service.effect.ts`. But the live `index.effect.ts` provides its **own** `GameStateLive` (built from the OTHER tag). Result: the Effect router will throw "service not found" the moment it tries to consume `GameState` because the provided tag is a different object than the one the handlers expect. Same dual-definition problem exists for `HttpServerService` (`index.effect.ts:32` vs `http-server.effect.ts:16` — different shapes `{HttpServer}` vs `{server, config}`) and `SocketIO` (`index.effect.ts:24` `SocketIO` vs `socket-io.effect.ts` `SocketIOServer`).

Today this is harmless (the Effect entry is not wired to `dev`). Tomorrow, whoever flips the `dev` script gets a hard-to-diagnose "service not found" failure. This plan picks `game-service.effect.ts` as the canonical source and deletes the duplicates in `index.effect.ts`.

## Current state

All paths relative to repo root.

- `apps/server/src/server/game-service.effect.ts` — defines `GameState` (lines 12-23), `makeGameState` (28-48), `makeGameStateLayer` (53-71), helper effects (76-96). Imports: `Context, Effect, Layer, Ref` from effect + the game types. This is the **canonical source** — the router/handlers import this file's `GameState`.
- `apps/server/src/index.effect.ts` — defines another `GameState` (lines 40-52), `makeGameState` (71-103), `SocketIOLive` (61), `HttpServerLive` (66), `GameStateLive` (108), helper effects (114-128), and the `serverProgram` (137-154) that uses `GameState` from THIS file's Tag.
- `apps/server/src/server/event-handlers.effect.ts:4` — `import { GameState, incrementLoversAlertCount } from './game-service.effect';`
- `apps/server/src/server/socket-event-router.effect.ts:5` — `import { GameState } from './game-service.effect';`
- `apps/server/src/server/http-server.effect.ts` — defines `HttpServerService` with a different shape than index.effect.ts's `HttpServerService`; not currently imported by the live socket router (which doesn't import `HttpServerService` at all). Out of scope for this plan beyond the doc-reference check.
- `apps/server/src/server/socket-io.effect.ts` — defines `SocketIOServer` and `broadcastFrom`; not imported in `index.effect.ts` (which defined its own `SocketIO` tag instead).

Confirmation: `grep -rn "import.*GameState" apps/server/src/` shows handlers import only from `game-service.effect.ts`; `index.effect.ts`'s `GameState` is consumed only internally within `index.effect.ts`.

### Repo conventions to follow

- Effect services use `Context.Tag('Name')<Service, Shape>()`. Match the canonical one in `game-service.effect.ts` (holders for stable game instances + a `Ref<number>`).
- Don't introduce a new layer file — `game-service.effect.ts` already has `makeGameStateLayer`. Use it.
- The `index.effect.ts` "Setup socket handlers" run path uses `gameState.gameEvents.setupSocketHandlers()` — the Effect-idiomatic equivalent is the router at `socket-event-router.effect.ts`'s `setupSocketEventHandlers(socket)`. Plan 015 covers wiring the router from `setupSocketEventHandlers`; this plan just reconciles the Tag and stops the landmine.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/index.effect.ts` — delete the local `GameState` Tag definition and helper effects; import them from `./server/game-service.effect`. Similarly delete the local `HttpServerService` and `SocketIO` Tags (if any handler or test references them — confirm with grep first; if none reference these outside index.effect.ts, delete; otherwise point them at the canonical files). Keep the `serverProgram` shell (the keyboard handler scaffolding + `Effect.never` runtime) intact, just using the canonical `GameState` from `game-service.effect.ts` along with `makeGameStateLayer` to build `AppLayer`.

**Out of scope**:
- `socket-event-router.effect.ts` and `event-handlers.effect.ts` wiring (they're dead until plan 015 / the SegmentsManager-port work).
- The unrelated tech-debt plan that addresses the broader duplicated socket-handler system (= plan 023).

## Git workflow

- Branch: `advisor/013-reconcile-gamestate-tag`
- Conventional commits — e.g. `refactor: unify GameState Context.Tag in game-service.effect.ts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm import inventory

Run `rg -n "import.*GameState" apps/server/src` to confirm only `socket-event-router.effect.ts` and `event-handlers.effect.ts` import `GameState` (both from `game-service.effect.ts`). Confirm `index.effect.ts`'s local `GameState` is consumed only within `index.effect.ts`.

Also run `rg -n "import.*HttpServerService|import.*SocketIO\b" apps/server/src` to confirm `index.effect.ts`'s local `HttpServerService` and `SocketIO` tags are not imported externally — the only place they'd break is internal consumers.

**Verify**: the grep output confirms the import graph as described. If anything else imports the local tags, STOP and report so the plan can be widened.

### Step 2: Make `game-service.effect.ts` the sole source; update `index.effect.ts`

In `apps/server/src/index.effect.ts`:

1. Delete the local `GameState` class definition (lines ~40-52).
2. Delete the local `makeGameState` helper (lines ~71-103).
3. Delete the local `resetLoversAlertCount` / `incrementLoversAlertCount` / `getLoversAlertCount` (lines ~114-128).
4. Delete the local `HttpServerService` (lines ~32-35) and `SocketIO` (lines ~24-27) tags if not imported elsewhere — their owning canonical files are `http-server.effect.ts` and `socket-io.effect.ts`. Only delete if Step 1's grep confirms no external importers exist (including the live `index.ts`, which does NOT import these — it uses plain construction). Keep `HttpServerLive` / `SocketIOLive` only if the `AppLayer` still needs the live instances; if so, point them at whatever the canonical files export (e.g. import from `./server/socket-io.effect` and `./server/http-server.effect` — but those file's Tag identities may differ; only wire what's needed for the `serverProgram`, deleting any unused layer).
5. Import `GameState`, `makeGameState`, `resetLoversAlertCount`, `incrementLoversAlertCount`, `getLoversAlertCount`, and `makeGameStateLayer` from `./server/game-service.effect`.
6. Rebuild `AppLayer` using `makeGameStateLayer(game, deathManager, audioManager, specialScenarios, segmentsManager, eventsActions)` — but that builder requires already-constructed game instances. The current `index.effect.ts:71-103` constructs them inside `Effect.gen`; the canonical `makeGameState` takes them as args. The simplest unified approach: keep instance construction in `index.effect.ts`'s top-level `Effect.gen` body, but feed the results to `makeGameStateLayer` instead of returning an object literal.

After the rewrite, `index.effect.ts` should:

- Import the canonical Tags and helpers from `./server/game-service.effect` (and `./server/socket-io.effect` / `./server/http-server.effect` if those canonical exports are needed).
- No longer own any local `Context.Tag` definitions.
- Build `AppLayer` from the imported layer factory.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Confirm there are zero surviving local Tag definitions

Run `rg -n "class GameState extends Context.Tag" apps/server/src/index.effect.ts` → should return no matches. Same for `HttpServerService extends Context.Tag` and `SocketIO extends Context.Tag`.

**Verify**: greps return no matches.

### Step 4: Full suite

**Verify**: `pnpm --filter server test:run` → 56 tests pass. None touch `index.effect.ts` (no test imports it) — so nothing should break.

## Test plan

- No new tests (this is dead/parallel code getting a one-time reconciliation). If verification infra for Effect layers ever lands, an integration test asserting "building `AppLayer` provides a `GameState` the handlers can consume" would catch this class of regression — but that's the SegmentsManager-port plan's job.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] `rg -n "class GameState extends Context.Tag" apps/server/src/index.effect.ts` returns no matches
- [ ] `rg -n "class HttpServerService extends Context.Tag|class SocketIO extends Context.Tag" apps/server/src/index.effect.ts` returns no matches
- [ ] `rg -n "import .* GameState.* from './server/game-service.effect'" apps/server/src/index.effect.ts` returns exactly one match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep reveals an **external** importer of `index.effect.ts`'s local `GameState` (anything other than within `index.effect.ts` itself). Report the consumer — the plan needs widening to migrate them too.
- `game-service.effect.ts`'s `makeGameStateLayer` signature differs from the one in this plan's "Current state" (e.g. it takes a different chain of args, or returns a `Layer.Layer` shape that doesn't compose with the existing `Layer.provideMerge` pattern in `AppLayer`). Report the mismatch and propose a minimal fix before continuing.
- `http-server.effect.ts` / `socket-io.effect.ts` already export their own canonical `Context.Tag`s with shapes materially different from what `index.effect.ts`'s local `HttpServerLive`/`SocketIOLive` provide — just delete those locals rather than rewire if they're unused (per Step 1 grep). If the `serverProgram` ends up needing an HTTP/Socket layer that doesn't exist externally, STOP and report — the plan's scope only covers GameState reconciliation, not building new HTTP/Socket wiring.

## Maintenance notes

- Once this lands, the next time someone wires the Effect router they'll get a working `GameState` context up to the missing `SegmentsManager` port — no more "service not found" landmine.
- The broader handler duplication (plain vs Effect wiring) is plan 023's scope — don't pre-empt it. This plan only kills the duplicitous Tags.
- If the `HttpServerService` and `SocketIO` Tags get deleted from `index.effect.ts` entirely, future plans wiring the live Effect entry may need to add them back from the canonical files. Record in `plans/README.md` or a followup note.