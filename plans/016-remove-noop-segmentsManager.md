# Plan 016: Remove no-op `this.segmentsManager;` statement in the witch-poison handler

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/server-events.ts`
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

`apps/server/src/server/server-events.ts:158` (inside the `witch:poisoned-player` handler) contains a bare `this.segmentsManager;` statement between `this.game.witchKill(playerSid)` and `this.segmentsManager.finishSegment()`. It evaluates a field and discards the result — a dead expression. It reads like an intended side effect that never happened (probably a leftover from a refactor). Misleading to readers and concidentally breaks lint rules in some configs.

This is a trivial one-line delete that pairs naturally with plan 006 (which guards this same handler) — but plan 006 is independent on this same range; merge conflicts are trivial either way.

## Current state

All paths relative to repo root.

- `apps/server/src/server/server-events.ts:156-160` — the handler:
  ```ts
  socket.on('witch:poisoned-player', (playerSid: string) => {
    this.game.witchKill(playerSid);
    this.segmentsManager;            // ← no-op statement (line 158)
    this.segmentsManager.finishSegment();
  });
  ```

### Repo conventions to follow

- Just delete the line. Don't refactor the handler further — plan 006 adds role validation to it; this plan is purely cosmetic.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all 56 pass         |

## Scope

**In scope**:
- `apps/server/src/server/server-events.ts` — delete one line.

**Out of scope**:
- The Effect handler variant (`event-handlers.effect.ts`) — that file's `handleWitchPoisonedPlayer` doesn't contain the no-op; nothing to do there.

## Git workflow

- Branch: `advisor/016-remove-noop-segmentsManager`
- Conventional commits — e.g. `chore: remove no-op statement in witch-poison handler`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete the no-op line

In `apps/server/src/server/server-events.ts`, in the `witch:poisoned-player` handler (~line 158), delete the bare `this.segmentsManager;` line. The handler should read:

```ts
socket.on('witch:poisoned-player', (playerSid: string) => {
  this.game.witchKill(playerSid);
  this.segmentsManager.finishSegment();
});
```

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Full suite

**Verify**: `pnpm --filter server test:run` → all 56 pass (no behavioral change).

## Test plan

- No new tests — deleting a dead expression changes no behavior; the existing 56-test suite is the gate.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] `grep -n "this.segmentsManager;" apps/server/src/server/server-events.ts` returns no matches (the bare-expression form)
- [ ] `grep -n "this.segmentsManager.finishSegment()" apps/server/src/server/server-events.ts` returns the expected count (still всех the legitimate finishSegment calls)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The line numbers in "Current state" don't match (drift; plan 006 may have already touched this handler — re-verify the line is still present).
- Removing the no-op statement changes the type-check result (unexpected shadowing — essentially impossible, but report if so).

## Maintenance notes

- Future refactors (e.g. moving witch interactions to an Effect program) should never re-introduce dead statements; biome's lint rules probably already warn — confirm in a future lint-config plan.