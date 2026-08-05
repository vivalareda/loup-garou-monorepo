# Plan 014: Fix `event-handlers.effect.ts` call to nonexistent `handleHunterPlayerPick`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/event-handlers.effect.ts apps/server/src/server/events-actions.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW (Effect handlers are dead code currently, but the wrong reference will throw the moment they're wired)
- **Depends on**: none (plan 013 reconciles the Tags; this fix is independent)
- **Category**: tech-debt
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`event-handlers.effect.ts:224` calls
`eventsActions.handleHunterPlayerPick(targetSid)`. `EventsActions` does not
define `handleHunterPlayerPick` — the real method is `submitHunterPick`
(`events-actions.ts:24-29`, returns boolean). When the Effect path gets
wired (post SegmentsManager port), the hunter flow — the most complex
interaction in the game — would throw immediately on the first hunter pick.
Today this is latent because the Effect handlers are not the active socket
path. But every passing day makes this easier to miss; the dead reference
should be fixed at the source.

## Current state

All paths relative to repo root.

- `apps/server/src/server/event-handlers.effect.ts:219-226` — the handler:
  ```ts
  export const handleHunterKilledPlayer = (targetSid: string) =>
    Effect.gen(function* () {
      const { eventsActions } = yield* GameState;

      yield* Effect.promise(() =>
        eventsActions.handleHunterPlayerPick(targetSid)   // ← does not exist
      );
    });
  ```

- `apps/server/src/server/events-actions.ts:24-29` — `submitHunterPick`:
  ```ts
  submitHunterPick(targetSid: string) {
    return (
      this.dayVoteResolution.submitHunterPick(targetSid) ||
      this.segmentsManager.nightDawnResolution.submitHunterPick(targetSid)
    );
  }
  ```
  Returns a boolean synchronously — NOT a Promise. Therefore `Effect.promise(() => eventsActions.handleHunterPlayerPick(...))` was doubly wrong: it expected a Promise from a sync method that doesn't exist.

- Reference: `apps/server/src/server/server-events.ts:184-190` — the live plain handler:
  ```ts
  socket.on('hunter:killed-player', (targetSid: string) => {
    if (!this.eventsActions.submitHunterPick(targetSid)) {
      console.warn(`hunter pick for ${targetSid} received but no resolution is waiting`);
    }
  });
  ```

### Repo conventions to follow

- `submitHunterPick` is synchronous and returns boolean. The Effect wrapper should use `Effect.sync` (or `Effect.gen` with `Effect.sync` for the call), not `Effect.promise`. Match the pattern used by sibling sync handlers (`handleWerewolfVote` at `event-handlers.effect.ts:123-130` uses `Effect.sync` — that's the exemplar).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |

## Scope

**In scope**:
- `apps/server/src/server/event-handlers.effect.ts` — fix the `handleHunterKilledPlayer` function.

**Out of scope**:
- Wiring the Effect router to the live socket path (plan 015 / SegmentsManager port, parked separately).
- Adding role validation to the Effect handler (= plan 006 covers the live plain handler; the Effect variant should mirror it when wired).
- `events-actions.ts` — leave `submitHunterPick` as-is.

## Git workflow

- Branch: `advisor/014-fix-hunter-handler-ref`
- Conventional commits — e.g. `fix(effect): use sync submitHunterPick in hunter handler`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace `Effect.promise(handleHunterPlayerPick)` with `Effect.sync(submitHunterPick)`

In `apps/server/src/server/event-handlers.effect.ts`, rewrite `handleHunterKilledPlayer`:

```ts
export const handleHunterKilledPlayer = (targetSid: string) =>
  Effect.gen(function* () {
    const { eventsActions } = yield* GameState;

    yield* Effect.sync(() => {
      if (!eventsActions.submitHunterPick(targetSid)) {
        console.warn(
          `hunter pick for ${targetSid} received but no resolution is waiting`
        );
      }
    });
  });
```

This mirrors the live handler's warning behavior (`server-events.ts:185-188`) and uses `Effect.sync` for the synchronous call — matching the sibling `handleWerewolfVote` pattern in the same file.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Confirm no other dead method references in the Effect handlers

Run `rg -n "eventsActions\." apps/server/src/server/event-handlers.effect.ts` and `rg -n "game\." apps/server/src/server/event-handlers.effect.ts`. Cross-check each call against `events-actions.ts` and `game.ts` to confirm they all exist.

If any other nonexistent reference is found, STOP and report — that's outside this plan's scope (only this one), but the plan should be aware.

**Verify**: typecheck + the grep confirms every reference resolves.

## Test plan

- No new tests — the Effect handlers are dead code; no test imports them. A future plan wiring the router can integration-test these handlers; for now, typecheck (= method must exist on the Effect) is the gate.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `grep -n "handleHunterPlayerPick" apps/server/src/` returns no matches
- [ ] `grep -n "submitHunterPick" apps/server/src/server/event-handlers.effect.ts` returns one match (inside `Effect.sync`)
- [ ] `grep -n "Effect.promise" apps/server/src/server/event-handlers.effect.ts` returns no matches inside `handleHunterKilledPlayer` (may still exist elsewhere in `handleDayVote`, which is legitimately async — that's fine)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 2 reveals additional dead references — STOP, list them, and ask whether to widen the plan.
- The Effect handlers actually are imported and used by something other than `socket-event-router.effect.ts` (which is itself unused) — STOP, the plan assumes these handlers are dead; if they're live, this needs a different approach.
- `Effect.sync` is not in the installed `effect` package version — STOP and report; the alternative is `Effect.try` or `Effect.sync` equivalent — but `Effect.sync` has been in Effect since v2.0, very likely fine.

## Maintenance notes

- Plan 015 (wire the Effect socket router) should integration-test the hunter pick flow end-to-end; this fix unblocks that.
- A broader checklist for the Effect handlers: when the router goes live, mirror plan 006's role validation into these handlers (don't assume the plain handlers' fixes carry over).