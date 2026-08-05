# Plan 026: Delete or repoint the stale `admin:simulate-day-vote` no-op handler

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/server-events.ts apps/server/src/server/socket-event-router.effect.ts apps/server/src/server/event-handlers.effect.ts packages/types/src/event.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`admin:simulate-day-vote` is registered as a log-only no-op — its body
`// For now, just log - day voting will be implemented later` directly
contradicts reality. Day voting IS implemented (`events-actions.ts:44-64`
`handleDayVote` drives the real `DayVoteResolution`) and functional
end-to-end, tested via the `admin:mock-day-vote-*` family
(`MockScenario.runDayVoteKill*`). The stale comment + no-op body mislead
dashboards and future contributors into thinking the path is broken. It
exists in BOTH the live `server-events.ts` and the dead Effect
`socket-event-router.effect.ts`, so it's two copies of the same rot.

This plan deletes both registrations (and the corresponding entry in
`packages/types/src/event.ts`), or — if the maintainer wants to preserve
the testing affordance — repoints them to drive the real resolution path
via `eventsActions.resolveDayVote` (like `MockScenario.runDayVoteKill*`
does for the scenario events). The plan's default action is to **delete** —
the mock-day-vote-* family already covers dashboard-driven day-vote
testing, and a half-repointed duplicate is more drift surface.

## Current state

All paths relative to repo root.

- `apps/server/src/server/server-events.ts:87-90` — the live no-op handler:
  ```ts
  socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
    console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
    // For now, just log - day voting will be implemented later
  });
  ```

- `apps/server/src/server/socket-event-router.effect.ts:51-56` — the dead Effect version:
  ```ts
  socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
    Effect.sync(() => {
      console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
      // For now, just log - day voting will be implemented later
    }).pipe(Effect.runPromise);
  });
  ```

- `packages/types/src/event.ts:81` — the `ClientToServerEvents` definition: `'admin:simulate-day-vote': null as unknown as (targetPlayer: string) => void`.

- Reference positive path: `apps/server/src/server/events-actions.ts:32-34`:
  ```ts
  resolveDayVote(player: Player) {
    return this.dayVoteResolution.run(player);
  }
  ```
  Callable entry to the real resolution, already used by MockScenario.

### Repo conventions to follow

- The `MockScenario` shows the pattern for "drive a test scenario from the dashboard": build the player manually, call `eventsActions.resolveDayVote(player)`. If the maintainer prefers the repoint path instead of delete, follow that pattern.
- Delete entries symmetrically — if the live handler is removed, remove the Effect one and the type entry too.
- Don't leave the type entry pointing at an unregistered handler.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/server/server-events.ts` — remove the `admin:simulate-day-vote` handler block (lines 87-90).
- `apps/server/src/server/socket-event-router.effect.ts` — remove the same handler block (lines 51-56).
- `packages/types/src/event.ts` — remove the `'admin:simulate-day-vote': ...` entry from `clientEventSchemas`.

**Out of scope**:
- Any new admin/mock handler — the existing `admin:mock-day-vote-*` family already covers the testing use case.
- Removing any other admin handler.

## Git workflow

- Branch: `advisor/026-delete-admin-simulate-day-vote`
- Conventional commits — e.g. `chore: remove stale admin:simulate-day-vote no-op handler`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm no dashboard / client emitter

Run `rg -n "admin:simulate-day-vote" apps/dashboard apps/mobile` — should return no matches today (the dashboard uses `admin:mock-day-vote-*` events).

If any dashboard or mobile file emits `admin:simulate-day-vote`, STOP and report — a repoint (Step 2b) may be required instead of delete (Step 2a). Otherwise continue to delete.

**Verify**: grep returns no matches outside server source.

### Step 2a: DELETE path (default)

If Step 1 confirms no client emits the event, delete the handler from both server files AND the type entry.

In `apps/server/src/server/server-events.ts`, remove the block at lines 87-90:
```ts
socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
  console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
  // For now, just log - day voting will be implemented later
});
```

In `apps/server/src/server/socket-event-router.effect.ts`, remove the analogous block (lines 51-56).

In `packages/types/src/event.ts`, remove the line:
```ts
  'admin:simulate-day-vote': null as unknown as (targetPlayer: string) => void,
```

**Verify**: `pnpm --filter server typecheck` → exit 0. `pnpm --filter server test:run` → 56 pass.

### Step 2b (alternative): REPOINT path — only if Step 1 finds a client emitter or the maintainer prefers

If repoint chosen (note in your final report why): rewrite the live handler to:

```ts
socket.on('admin:simulate-day-vote', (targetPlayer: string) => {
  console.log(`☀ Admin simulating day vote for: ${targetPlayer}`);
  const targetPlayerSid = targetPlayer; // assume socket id passed
  const player = this.game.getPlayerBySocketId(targetPlayerSid);
  if (!player) {
    console.warn(`admin:simulate-day-vote: player ${targetPlayerSid} not found`);
    return;
  }
  this.eventsActions.resolveDayVote(player);
});
```

Mirror the repoint in `socket-event-router.effect.ts`'s Effect variant (use `Effect.sync` for the sync-resolving path — `resolveDayVote` returns a Promise internally via `Effect.runPromise`, so it's effectively fire-and-forget; wrap the dispatch in a `runHandler` if that's the file's convention).

Note: repoint adds a weapons-grade "kill arbitrary player instantly" admin affordance — confirm before committing. The default DELETE path is safer.

### Step 3: Sanity confirm no orphans

```bash
rg -n "admin:simulate-day-vote" apps/server/src apps/dashboard/src apps/mobile  # no matches
rg -n "admin:simulate-day-vote" packages/types/src  # no matches
```

**Verify**: greps return no matches.

### Step 4: Full suite

**Verify**: `pnpm --filter server test:run` → 56 pass.

## Test plan

- No new tests. The handler was a no-op (or in the repoint case, an admin-restricted facilitator); the existing `admin:mock-day-vote-*` handler tests cover the real path's coverage.

## Done criteria

ALL must hold (DELETE path):

- [ ] `rg -n "admin:simulate-day-vote" apps/ packages/` returns no matches
- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

(For REPOINT path: same except the grep returns matches in `server-events.ts` + the router; the handler bodies call `eventsActions.resolveDayVote(player)` it won't be a no-op.)

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 reveals a dashboard or mobile consumer of `admin:simulate-day-vote` — STOP; the maintainer must choose between repointing (= Step 2b) or migrating the consumer to the `admin:mock-day-vote-*` family. The default delete would break those consumers.
- Removing the type entry from `event.ts` causes a TS error in `clientEventSchemas satisfies Record<EventName, ...>` (e.g. `EventName` itself references the literal) — STOP; refresh the type plumbing so the `EventName` union also drops `'admin:simulate-day-vote'`.

## Maintenance notes

- The `admin:mock-day-vote-*` family is the preferred dashboard-driven day-vote test path going forward. Future mock scenarios should extend that family rather than re-add a half-baked `simulate-day-vote`.
- When the Effect router goes live (= parked SegmentsManager port), review it for similar stale no-op handlers — the duplication pattern is the tax of the migration; this is a small repayment.