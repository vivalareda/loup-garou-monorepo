# Plan 015: Delete dead and duplicate code in `Game` (commented-out block, identical methods, deprecated alias)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/core/game.ts apps/server/src/server/server-events.ts apps/server/src/server/event-handlers.effect.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (deleting verified-unused code; tests pin behavior)
- **Depends on**: none (Plan 008 may also touch `processPendingDeaths` in `game.ts`; merge conflicts are trivial, fix independently)
- **Category**: tech-debt
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`apps/server/src/core/game.ts` is 894 lines — the largest file in the server
by a wide margin, is imported by nearly every server module, and is
high-churn. About 180 lines of that are commented-out duplicate copies of
the live methods right above them (lines 716-894) — they rot in parallel
and contain bugs the live copies may have already fixed (e.g. the
`alertWinnersAndLosers` commented block at line 833 has the same werewolf-loser
bug that the live code still has today and is fixed by plan 003 — both
copies drift together). Additionally:

- `isAnyOfLoverHunter()` (lines 179-186) and `isOneOfLoversHunter()` (lines 206-213) are byte-for-byte identical (both iterate `this.lovers` for a `HUNTER` role) and BOTH have zero callers anywhere in the repo.
- `alertPlayerOfDeath()` (lines 505-513) is marked `@deprecated`, has no live callers (grep confirms only the commented-out call at line 827), and the live code uses `Game.handlePlayerDeath` / `Player.kill` instead.
- `assignRandomRoles()` (lines 495-497) is a one-line alias `this.assignRoles();` — two callers (`server-events.ts:58`, `event-handlers.effect.ts:68`) can just call `assignRoles()` directly.

Removing these trims ~190 lines off the largest, most-imported server file
and eliminates sibling methods that nobody knows to copy-fix in tandem.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/core/game.ts:716-894` — commented-out block. Contains duplicate copies of `getWerewolfTarget`, `healWerewolfVictim`, `witchKill`, `canWitchHeal`, `calculateDayVoteTallies`, `hasAllPlayersVoted`, `getDayVoteTarget`, `handleDayVotePlayer`, `alertWinnersAndLosers`, `alertLosers`, `checkIfWinner`. Line 833 has the same werewolf-loser bug as the live code (plan 003 fixes the live copy).
- `apps/server/src/core/game.ts:179-186` — `isAnyOfLoverHunter()`:
  ```ts
  isAnyOfLoverHunter() {
    for (const lover of this.lovers) {
      if (lover.getRole() === 'HUNTER') {
        return true;
      }
    }
    return false;
  }
  ```
- `apps/server/src/core/game.ts:206-213` — `isOneOfLoversHunter()` is byte-for-byte identical to the above.
- `apps/server/src/core/game.ts:505-513` — `alertPlayerOfDeath` with `@deprecated` JSDoc tag.
- `apps/server/src/core/game.ts:495-497` — `assignRandomRoles()`:
  ```ts
  assignRandomRoles() {
    this.assignRoles();
  }
  ```
- Callers of `assignRandomRoles`: `apps/server/src/server/server-events.ts:58` (in `admin:start-game`). Effect handler `event-handlers.effect.ts:68` calls `game.assignRandomRoles()`.

Confirmation steps already run during audit (these are grep facts recorded in the audit findings). Re-run grep before doing surgery to be sure.

### Repo conventions to follow

- Inline callers — e.g. when removing `assignRandomRoles`, change its two call sites to call `assignRoles()` directly.
- Match the existing biome formatting (`apps/server` uses `biome format`).
- No comments left behind like "deleted X here" — clean removal.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all 56 pass         |
| Verify removals | `grep -n "isAnyOfLoverHunter\|isOneOfLoversHunter\|alertPlayerOfDeath\|assignRandomRoles" apps/server/src/core/game.ts` | returns no matches |

## Scope

**In scope**:
- `apps/server/src/core/game.ts` — delete lines 716-894 (commented-out block), delete `isAnyOfLoverHunter`, delete `isOneOfLoversHunter`, delete `alertPlayerOfDeath`, delete `assignRandomRoles`.
- `apps/server/src/server/server-events.ts` — change `this.game.assignRandomRoles()` to `this.game.assignRoles()`.
- `apps/server/src/server/event-handlers.effect.ts` — change `game.assignRandomRoles()` to `game.assignRoles()`.

**Out of scope**:
- All other methods in `game.ts` (decomposition into collaborators = a future plan; this plan only deletes dead code).
- The `DeathManager.removePendingDeath` implicit-undefined-return issue (called out by audit as below bar; not in scope).

## Git workflow

- Branch: `advisor/015-delete-dead-game-methods`
- Conventional commits — e.g. `refactor: remove dead code from Game (commented block + unused methods + deprecated alias)`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Re-confirm zero callers via grep

Before any edit:

```bash
rg -n "isAnyOfLoverHunter" apps/server/src/                   # expects: only the definition at game.ts
rg -n "isOneOfLoversHunter" apps/server/src/                 # expects: only the definition at game.ts
rg -n "alertPlayerOfDeath" apps/server/src/                  # expects: only the definition at game.ts (and the commented block line 827 if still present)
rg -n "assignRandomRoles" apps/server/src/                   # expects: definition + 2 callers (server-events.ts:58, event-handlers.effect.ts:68)
```

**Verify**: greps match the expectations. If anything else shows up, STOP and report.

### Step 2: Inline `assignRandomRoles` callers

In `apps/server/src/server/server-events.ts` at the `admin:start-game` handler (~line 58): replace `this.game.assignRandomRoles()` with `this.game.assignRoles()`.

In `apps/server/src/server/event-handlers.effect.ts` at `handleAdminStartGame` (~line 68): replace `game.assignRandomRoles()` with `game.assignRoles()`.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Delete the dead methods in `game.ts`

In `apps/server/src/core/game.ts`:

- Delete `assignRandomRoles()` method (lines ~495-497).
- Delete `alertPlayerOfDeath()` method (lines ~505-513) including the `@deprecated` JSDoc above it.
- Delete `isAnyOfLoverHunter()` method (lines ~179-186).
- Delete `isOneOfLoversHunter()` method (lines ~206-213).

**Verify**: `pnpm --filter server typecheck` → exit 0. (Type-failure here would mean an unexpected caller — STOP and report.)

### Step 4: Delete the commented-out block (lines 716-894)

Delete the entire block from the `//   getWerewolfTarget() {` comment block opener at line 716 to the closing `// }` at line 894. After deletion, `game.ts` should end with the live `checkIfWinner`'s closing brace.

**Verify**: `pnpm --filter server typecheck` → exit 0. (Type failure would mean I miscounted and something live was inside the block.)

### Step 5: Full suite

**Verify**: `pnpm --filter server test:run` → all 56 pass. If a test breaks because it imports `Game` AND calls one of the deleted methods internally — STOP and report; the audit said zero callers but a test may call directly.

## Test plan

- No new tests — these are pure deletions of unused methods. The existing 56-test suite is the gate.
- One sanity assertion worth recording in the done criteria: the affected file's line count drops by ~190.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] `grep -rn "isAnyOfLoverHunter" apps/server/src/` returns no matches
- [ ] `grep -rn "isOneOfLoversHunter" apps/server/src/` returns no matches
- [ ] `grep -rn "alertPlayerOfDeath" apps/server/src/` returns no matches
- [ ] `grep -rn "assignRandomRoles" apps/server/src/` returns no matches
- [ ] `grep -rn "//   getWerewolfTarget()` returns no matches (commented-out block opener is gone)
- [ ] `wc -l apps/server/src/core/game.ts` returns a number near (~704 lines; the file should end cleanly with the live `checkIfWinner`)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's grep finds a caller outside the in-scope list — STOP, name it, and confirm the plan can be widened or that the called thing was mis-attributed.
- A direct test of `Game` references `alertPlayerOfDeath` or `assignRandomRoles` as assertions — the test was relying on deprecated behavior; don't keep the dead code for it, but STOP and report so the test can be updated alongside the deletion.
- The line range 716-894 doesn't fully match the cited block — e.g. there are interspersed live methods that look commented at first glance but compile. STOP and report — some live code can be inside `//   {` style stubs; never delete code that the typecheck needs.

## Maintenance notes

- Falling line count of `game.ts` is a milestone toward eventual decomposition (player-registry, vote-manager, witch-state collaborators) — that's a separate plan, NOT covered here.
- If a future plan introduces a new win-condition branch, the existing `alertWinnersAndLosers` pattern will need extending (the commented-out duplicate was tracking the same drift — confirming that the commented block was actively misleading; its removal is the point).