# Plan 005: Call `cleanup()` on game restart so stale `io.on('connection')` handlers don't stack

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/index.ts apps/server/src/server/server-events.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The server reads `r` from stdin to reset state and start a new game, used
between matches during local testing. Each press calls `initGame()`, which
constructs a new `GameEvents` and calls `events.setupSocketHandlers()` —
which registers `this.io.on('connection', ...)` on the singleton `io`
instance (`sockets.ts:7`). Old `GameEvents` instances are never cleaned up
(`cleanup()` is defined at `server-events.ts:285-289` but grep confirms zero
call sites). After N restarts, every new socket connection fires N+1
`connection` handlers: player additions and role assignments hit stale
`Game`/`SegmentsManager` instances that have nothing to do with the current
game. The `loversAlertClosed` counter on stale instances may fire
`finishSegment()` on the wrong segments manager.

## Current state

All paths relative to repo root.

- `apps/server/src/index.ts` — the active entry point:
  ```ts
  let game: Game;
  let audioManager: AudioManager;
  let segmentsManager: SegmentsManager;
  let events: GameEvents;
  let deathManager: DeathManager;
  let eventsActions: EventsActions;
  let specialScenarios: SpecialScenarios;

  const initGame = () => {
    deathManager = new DeathManager();
    game = new Game(io, deathManager);
    // ... construct audioManager, specialScenarios, segmentsManager, eventsActions ...
    events = new GameEvents(game, segmentsManager, io, eventsActions);
    events.setupSocketHandlers();
  };

  process.stdin.on('data', (key: string) => {
    const keyPressed = key.toString().toLowerCase();
    if (keyPressed === 'r') {
      console.log('Resetting game state...');
      initGame();
    }
  });

  initGame();
  startServer();
  ```

- `apps/server/src/server/server-events.ts:285-289` — `cleanup()`:
  ```ts
  cleanup() {
    this.io.removeAllListeners();
    this.loversAlertClosed = 0;
    this.setupSocketHandlers();
  }
  ```
  Note `cleanup()` itself re-registers handlers via `setupSocketHandlers()` — which would chain correctly IF `initGame` called it, but since it re-builds the whole `GameEvents` instance, the simpler fix is `this.io.removeAllListeners('connection')` in `initGame` itself.

- The `io` singleton (`apps/server/src/server/sockets.ts:7`) is shared across all restarts.

### Repo conventions to follow

- The existing `cleanup()` uses `this.io.removeAllListeners()`. We'll use the more targeted `removeAllListeners('connection')` to avoid wiping unrelated HTTP-side listeners. Match the codebase style: plain `process.stdin.on` + guard for `process.stdin.isTTY` (already present at `index.ts:13-19`).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/index.ts` — call `io.removeAllListeners('connection')` (or `events?.cleanup()` if you prefer, but careful: `cleanup()` re-runs `setupSocketHandlers` on a stale instance — see Step 1).

**Out of scope**:
- `apps/server/src/server/server-events.ts` — `cleanup()` already exists; don't redefine it.
- The Effect entry `index.effect.ts` — game restart there is parked (logging only).
- Any new tests — this is a dev-only flow (stdin 'r'); a unit test would need a mock stdin + real `io` and is not worth it for a one-liner.

## Git workflow

- Branch: `advisor/005-cleanup-on-game-restart`
- Conventional commits — e.g. `fix: clear io connection listeners before reinitializing game`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Clear prior connection handler before re-registering

In `apps/server/src/index.ts`, modify `initGame()` so the FIRST thing it does (before any `new ...`) is wipe prior connection listeners on the singleton `io`. Add the relayed import of `io` if it's not already in scope (it is — `index.ts:8` imports `io`).

```ts
const initGame = () => {
  io.removeAllListeners('connection');
  deathManager = new DeathManager();
  game = new Game(io, deathManager);
  // ... (rest unchanged)
  events.setupSocketHandlers();
};
```

Do NOT call `events?.cleanup()` — it would re-run `setupSocketHandlers()` on the stale instance; the single-line `removeAllListeners('connection')` is the targeted fix. Use `'connection'` specifically (not bare `removeAllListeners()`) so any HTTP-side or engine.io listeners stay intact.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Run the suite

**Verify**: `pnpm --filter server test:run` → all 56 tests pass. The tests don't exercise stdin; nothing should break.

## Test plan

- No new tests. A mock stdin/real-`io` harness for a dev-only 'r' restart is disproportionate; manual verification (start server, add a player, press 'r', connect again — verify only one `Player joined` log per connection) is the right gate.
- If a future GameEvents integration test plan lands, add a regression test there: "after `initGame()` runs twice, only one connection handler fires per new socket."

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (all 56 pass)
- [ ] `grep -n "io.removeAllListeners('connection')" apps/server/src/index.ts` returns one match at the top of `initGame()`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `index.ts` doesn't match the excerpts in "Current state" (drifted since this plan was written — e.g. `initGame` signature is different, or `io` is not a singleton import).
- `io.removeAllListeners('connection')` is shadowed by a different `removeAllListeners` overload that breaks other socket behavior on your installed `socket.io` version — report and confirm.

## Maintenance notes

- The Effect entry point (`index.effect.ts`) has a TODO for restart via Refs — when that lands, it should adopt the equivalent: rebuilding layers or wiping listeners via the Effect handler router's cleanup, not by mutating the global singleton.
- The wider disconnect-cleanup gap (= plan 007) is the production-facing version of this — when 007 lands and the disconnect handler actively removes players, the restart handler should mirror any new state moves.
- If multi-room support is added, `removeAllListeners('connection')` stays correct (connection fires once per socket); only the per-socket handler needs room-scoping.