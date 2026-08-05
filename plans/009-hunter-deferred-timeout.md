# Plan 009: Add timeout to hunter `Deferred` so the game can't hang forever

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/day-vote-resolution.ts apps/server/src/server/night-dawn-resolution.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (designs skip-vs-random fallback behavior)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

Both resolution programs (`day-vote-resolution.ts` and
`night-dawn-resolution.ts`) park the Effect program on
`Deferred.await(pick)` until the hunter's `hunter:killed-player` socket
event arrives. There's no `Effect.timeout`. If the hunter disconnects (=
plan 007 partially addresses by killing them on disconnect, but
`submitHunterPick` doesn't get called in that path — see Step 1), closes
the app, or just never picks, the `Deferred` never resolves, the Effect
program hangs, `dayAction()` never runs, and the segment never advances.
The game is permanently stuck with no recovery short of 'r' restart (plan
005) or server restart.

This plan adds a 60-second timeout to the `awaitHunterPick` Effect in
both resolution programs. On timeout, the hunter's revenge kill is
**skipped** (they ran out of time) and the flow continues. 60s matches
the modal-UI budget; a future tuning can make it env-var driven.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/server/day-vote-resolution.ts:99-106` — `awaitHunterPick`:
  ```ts
  private awaitHunterPick() {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string>();
      this.pendingHunterPick = pick;
      this.io.emit('hunter:pick-required');
      return yield* Deferred.await(pick);
    });
  }
  ```

- `apps/server/src/server/night-dawn-resolution.ts:151-158` — `awaitHunterPick`:
  ```ts
  private awaitHunterPick() {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string>();
      this.pendingHunterPick = pick;
      this.io.emit('hunter:pick-required');
      return yield* Deferred.await(pick);
    });
  }
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

- `apps/server/src/server/day-vote-resolution.ts:85-97` — the consumer of `awaitHunterPick`:
  ```ts
  if (dead.getRole() === 'HUNTER') {
    yield* this.play('Day-vote/Hunter');
    const targetSid = yield* this.awaitHunterPick();
    const target = this.game.getPlayerBySocketId(targetSid);
    if (target?.isAlive) {
      this.killPlayer(target);
      yield* this.resolveConsequences(target);
    }
  }
  ```
  Today `targetSid` is always a real string; after timeout the return becomes `null` and the caller must handle it.

- Effect imports in both files: `import { Deferred, Effect } from 'effect';`

### Repo conventions to follow

- Both resolution files use `Effect.gen` + `yield*` linear style. Keep that.
- Match the existing `Effect.promise(() => ...)` wrapping style around non-Effect calls.
- Use `Duration` literals (Effect's `Duration.seconds` or `Duration.millis`); the package is already a dependency.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/server/day-vote-resolution.ts` — add timeout to `awaitHunterPick`, handle the timeout-return-null in `resolveConsequences`.
- `apps/server/src/server/night-dawn-resolution.ts` — add timeout to `awaitHunterPick`, handle the timeout-return-null in `hunterPickAndContinue`.
- `apps/server/src/__tests__/day-vote-scenarios.test.ts` — add one test for the timeout-skip behavior.

**Out of scope**:
- `events-actions.ts` `submitHunterPick` (unchanged — works as-is).
- Plan 007 disconnect handling (separate plan; interacts but doesn't depend).
- Changing the timeout duration (a future tuning; this plan pins 60s).

## Git workflow

- Branch: `advisor/009-hunter-deferred-timeout`
- Conventional commits — e.g. `fix: timeout the hunter pick Deferred after 60s`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Update the import line in both resolution files

In `apps/server/src/server/day-vote-resolution.ts` AND `apps/server/src/server/night-dawn-resolution.ts`, change the Effect import to include `Duration`:

```ts
import { Deferred, Duration, Effect } from 'effect';
```

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Add the timeout to `awaitHunterPick` in `day-vote-resolution.ts`

Change the return type to `Effect.Effect<string | null>` (null on timeout) and wrap the `Deferred.await` with `Effect.timeout`:

```ts
private awaitHunterPick(): Effect.Effect<string | null> {
  return Effect.gen(this, function* () {
    const pick = yield* Deferred.make<string>();
    this.pendingHunterPick = pick;
    this.io.emit('hunter:pick-required');
    const result = yield* Effect.timeout(
      Deferred.await(pick),
      Duration.seconds(60)
    );
    if (result._tag === 'None') {
      console.warn('Hunter pick timed out — skipping revenge kill');
      this.pendingHunterPick = null;
      return null;
    }
    return result.value;
  });
}
```

Note: `Effect.timeout` returns `Option<A>`. The Effect `Option` is tagged `'Some'` / `'None'`. Confirm this shape at compile time — if your Effect version's `Effect.timeout` returns a different Option representation, STOP and report.

**Verify**: `pnpm --filter server typecheck` → exit 0 (or see STOP conditions if `Option` shape differs).

### Step 3: Update `resolveConsequences` to handle the `null` return

In `day-vote-resolution.ts` `resolveConsequences` (the `if (dead.getRole() === 'HUNTER')` block):

```ts
if (dead.getRole() === 'HUNTER') {
  yield* this.play('Day-vote/Hunter');
  const targetSid = yield* this.awaitHunterPick();

  if (targetSid === null) {
    return; // hunter didn't pick in time — no revenge kill, flow continues
  }

  const target = this.game.getPlayerBySocketId(targetSid);
  if (target?.isAlive) {
    this.killPlayer(target);
    yield* this.resolveConsequences(target);
  }
}
```

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 4: Add the same timeout to `night-dawn-resolution.ts`

Mirror Steps 2 & 3 in `apps/server/src/server/night-dawn-resolution.ts`. Its `hunterPickAndContinue` (lines 113-148) currently consumes the pick like:

```ts
const targetSid = yield* this.awaitHunterPick();
this.game.killHunterRevenge(targetSid);
// ...
```

Update to:

```ts
const targetSid = yield* this.awaitHunterPick();

if (targetSid === null) {
  console.warn('Night-dawn hunter pick timed out — skipping revenge kill');
  // Flow continues to the day action; no revenge kill applied
  if (this.segmentsManager.isGameOver()) {
    return;
  }
  yield* Effect.promise(() => audioManager.playDayVoteAudio());
  yield* Effect.promise(() => this.segmentsManager.getGameActions().dayAction());
  return;
}

this.game.killHunterRevenge(targetSid);

// ... (rest of hunterPickAndContinue unchanged)
```

Keep the existing `isHunterVictimInLove` partner-suicide logic intact — it only runs when `targetSid` is non-null.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 5: Add a timeout test

In `apps/server/src/__tests__/day-vote-scenarios.test.ts` (the day-vote suite; there's already a hunter scenario test here as the exemplar — read it before writing), add:

- A test that drives a day-vote-eliminate-hunter scenario but never calls `submitHunterPick`. Use vitest's `vi.useFakeTimers()` (or `vi.advanceTimersByTimeAsync`) to advance 60s; assert `dayAction` runs after the timeout and the hunter's revenge kill is skipped (target stays alive).
- Pattern the test on the existing `day-vote-scenarios` hunter test — same setup, same mock `io`/`audioManager` (mocked at the module level to avoid playing mp3s).
- If the existing suite does not already provide a way to drive time without waiting 60s in real time, look for a `vi.useFakeTimers` setup pattern in `day-vote-scenarios.test.ts` or `hunter-scenarios.test.ts`; if absent, add one explicitly scoped to the timeout test.

**Verify**: `pnpm --filter server test:run -- day-vote-scenarios` → passes.

### Step 6: Full suite

**Verify**: `pnpm --filter server test:run` → all tests pass. The new test exercises a code path the previous suite couldn't (it would deadlock).

## Test plan

See Step 5 — one new test in `day-vote-scenarios.test.ts` asserting the bypass on timeout. Add a second in `night-dawn-scenarios.test.ts` for the night-dawn path, mirroring the same pattern, if a harness exists; otherwise a single test against the shared `awaitHunterPick` via the day-vote path is sufficient (the night-dawn code is structurally identical).

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0; new timeout test passes
- [ ] `grep -n "Effect.timeout" apps/server/src/server/day-vote-resolution.ts` returns one match
- [ ] `grep -n "Effect.timeout" apps/server/src/server/night-dawn-resolution.ts` returns one match
- [ ] `grep -n "Duration.seconds(60)" apps/server/src/server/day-vote-resolution.ts apps/server/src/server/night-dawn-resolution.ts` returns two matches (one per file)
- [ ] `grep -n "targetSid === null" apps/server/src/server/day-vote-resolution.ts apps/server/src/server/night-dawn-resolution.ts` returns matches in both files
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `Effect.timeout`'s Option shape is different from `result._tag === 'None'` in your Effect version — STOP and report the actual signature (Effect's `Option` shape has historically been `{_tag: 'Some', value}` / `{_tag: 'None'}` since Effect 2.x; if it changed, the import may need to change).
- `Effect.timeout` is not present in the installed Effect 3.21.4 — STOP and report; the alternative is `Effect.race(Deferred.await(pick), Effect.sleep(Duration.seconds(60)))` returning whichever wins, with a null fallback — but confirm with the maintainer first.
- A new `Effect.sleep`-based mock-timer test pattern requires `vi.useFakeTimers()` + test-config changes; if the existing vitest config lacks fake-timer support for `Effect.sleep`, report and adjust by using `vi.useFakeTimers({ toFake: ['setTimeout'] })` or by introducing a small Effect clock layer — STOP and report the harness change so the plan can be refreshed.
- An existing `day-vote-scenarios.test.ts` test breaks because its `audioManager.playHunterAudio` mock sequence changed order after the bypass return — update the existing test to reflect the new flow, but STOP and report if the bypass behaviour conflicts with a documented audio contract.

## Maintenance notes

- Timeout duration (60s) should become an env var (`HUNTER_PICK_TIMEOUT_SECONDS`) in a future plan — record this; for now, it's a constant referenced in both files. If both copies diverge later, extract a `HUNTER_PICK_TIMEOUT` const into a shared module.
- Plan 007 (disconnect handling) kills the hunter on disconnect but does NOT auto-resolve the `Deferred` — a follow-up plan should make `nightDawnResolution?.submitHunterPick(null)` (or `submitHunterPick(sidOfHunterIfSkipByDeath)`) called by `handleDisconnect` when the leaver is the hunter, so the disconnect path picks explicitly rather than waiting for the 60s timer. Record as follow-up.
- If the hunter suicide-on-disconnect path lands, this timeout still functions as the network-quiet happy-path fallback.