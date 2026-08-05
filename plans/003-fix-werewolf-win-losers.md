# Plan 003: Fix werewolf-win sending `alert:player-lost` to werewolves instead of villagers

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/core/game.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (one string literal change, only affects the werewolf-win path)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

When werewolves win, the server currently emits `alert:player-won` to
werewolves (correct) AND `alert:player-lost` to werewolves instead of
villagers (wrong). Villagers — who actually lost — get neither notification.
On the mobile client, `alert:player-lost` triggers
`router.replace('/loser-screen')`, so every werewolf in the game is told they
won AND lost, then redirected to the loser screen, while villagers see
nothing and stay on the game screen forever. This is the endgame screen of a
real-time multiplayer game and it is currently wrong for both teams.

## Current state

All paths relative to repo root.

- `apps/server/src/core/game.ts:656-684` — `alertWinnersAndLosers(winner)` method:
  ```ts
  alertWinnersAndLosers(winner: 'villagers' | 'werewolves') {
    if (winner === 'villagers') {
      for (const player of this.deathManager.getTeamVillagers()) {
        this.io.to(player.getSocketId()).emit('alert:player-won');
      }
      this.alertLosers('werewolves');   // ← correct: losers are werewolves
    }

    if (winner === 'werewolves') {
      for (const player of this.deathManager.getTeamWerewolves()) {
        this.io.to(player.getSocketId()).emit('alert:player-won');
      }
      this.alertLosers('werewolves');   // ← BUG: should be 'villagers'
    }
  }
  ```
  The bug is `game.ts:668`: `this.alertLosers('werewolves')` inside the `winner === 'werewolves'` branch.

- `apps/server/src/core/game.ts:672-684` — `alertLosers(loser)` emits `alert:player-lost` to every player in `getTeam<Capitalized(loser)>()`. So `alertLosers('werewolves')` sends lost events to werewolves (the winners).

- Mobile consumer: `apps/mobile/hooks/use-game-events.ts:67-69` — `socket.on('alert:player-lost', () => { router.replace('/loser-screen'); })`. So werewolves get redirected to the loser screen on a win.
- Mobile consumer: `apps/mobile/hooks/use-game-events.ts:62-65` — `socket.on('alert:player-won', () => { router.replace('/winner-screen'); })`.

### Repo conventions to follow

- The companion `alertPlayerDied` style: simple `if` per team, one literal per branch. Match it.
- No new imports.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run -- alertWinners alertLoser` | existing tests pass (no match is also fine — there are none today) |
| Full tests | `pnpm --filter server test:run`         | 56 pass             |

## Scope

**In scope** (the only files you should modify):
- `apps/server/src/core/game.ts` — the one-line fix at line 668.
- `apps/server/src/core/__tests__/game.test.ts` — add a regression test (see Test plan).

**Out of scope**:
- `apps/server/src/core/game.ts:716-894` — commented-out block; leave it (a separate plan removes it).
- The mobile endgame screens — they consume the existing events correctly; the fix is server-side only.

## Git workflow

- Branch: `advisor/003-fix-werewolf-win-losers`
- Commit per logical unit; conventional commits — e.g. `fix: alert villagers (not werewolves) of loss on werewolf win`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the wrong team literal

In `apps/server/src/core/game.ts`, inside `alertWinnersAndLosers`, change the `winner === 'werewolves'` branch from `this.alertLosers('werewolves')` to `this.alertLosers('villagers')`. The result of that method block should read:

```ts
if (winner === 'werewolves') {
  for (const player of this.deathManager.getTeamWerewolves()) {
    this.io.to(player.getSocketId()).emit('alert:player-won');
  }
  this.alertLosers('villagers');
}
```

Leave the `winner === 'villagers'` branch (which already says `this.alertLosers('werewolves')`) untouched.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Add the regression test

In `apps/server/src/core/__tests__/game.test.ts`, find the existing `describe('checkIfWinner')` block (or any existing block that already constructs `Game` with a mock `io` — follow that pattern exactly as the exemplar). Add one test:

```ts
it('alerts villagers (not werewolves) of loss on werewolf win', () => {
  // setup identical to existing checkIfWinner tests — both teams with one
  // alive player; call alertWinnersAndLosers('werewolves').
  // Assert: io.to(villagerSid).emit('alert:player-lost') called once,
  //         io.to(werewolfSid).emit('alert:player-lost') NOT called.
});
```

Use the existing test's `Game` construction as the exemplar — do not invent a new harness. The existing tests already mock `io` (with `vi.fn()` per socket). Match that mock pattern.

Model the test on the existing tests in the same file that exercise `checkIfWinner` or `alertWinnersAndLosers` (read them first — file is ~386 lines).

**Verify**: `pnpm --filter server test:run -- alertWinners` → 1 test passes.

### Step 3: Full suite sanity

Run the full server test suite.

**Verify**: `pnpm --filter server test:run` → all existing 56 tests + the 1 new test pass.

## Test plan

- New test in `apps/server/src/core/__tests__/game.test.ts`: `alerts villagers (not werewolves) of loss on werewolf win`.
  - Happy path: `alertWinnersAndLosers('werewolves')` emits exactly one `alert:player-lost` to each villager and zero to werewolves.
  - Regression bug this fixes: prior to the change, this test would fail — `alert:player-lost` was being sent to werewolves.
- Model after the existing `checkIfWinner` tests in the same file — use the same `Game` + mock `io` pattern. Read those tests before writing yours.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0; new test for werewolf-win losers exists and passes
- [ ] `grep -n "alertLosers('werewolves')" apps/server/src/core/game.ts` returns exactly one match (in the `winner === 'villagers'` branch)
- [ ] `grep -n "alertLosers('villagers')" apps/server/src/core/game.ts` returns exactly one match (in the `winner === 'werewolves'` branch)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `game.ts:656-684` doesn't match the excerpts in "Current state" (drifted since this plan was written).
- The existing `game.test.ts` does NOT contain any `describe('checkIfWinner')` or similar harness — report instead of inventing a new test harness.
- A step's verification fails twice after a reasonable fix attempt.

## Maintenance notes

- This method has a commented-out duplicate at `game.ts:833-848` that contains the same bug — when the dead-code plan (016) deletes that block, the bug won't survive.
- The mobile client's `use-game-events.ts` already has the correct routing for both events — no client change needed.
- If a future plan introduces a third win condition (e.g., lovers-win), revisit this method to ensure the loser branch covers every non-winner team.