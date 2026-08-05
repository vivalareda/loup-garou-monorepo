# Plan 008: Fix `killHunterRevenge` double-kill on `processPendingDeaths`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/core/game.ts apps/server/src/core/death-manager.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (existing tests pin the current double-emit; this plan updates them deliberately)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`Game.killHunterRevenge(sid)` (`game.ts:524-543`) does two things:
1. `addHunterRevenge(sid, hunterSid)` — queues a `HUNTER_REVENGE` entry in the `DeathManager` pending-deaths map.
2. `handlePlayerDeath(player)` — kills the player **immediately**, which emits `alert:player-is-dead` to the victim's socket and `lobby:player-died` to all clients (`player.ts:61-68`).

Later, `GameActions.dayAction()` (`game-actions.ts:119-120`) calls `Game.processPendingDeaths()` (`game.ts:421-479`), which iterates the queued `HUNTER_REVENGE` entry — the player is now already dead (`isAlive: false`) — and calls `handlePlayerDeath` again, emitting `alert:player-is-dead` and `lobby:player-died` a second time. On the mobile client, the duplicate `alert:player-is-dead` routes to `router.replace('/death-screen')` twice, causing double navigation + double state mutations. The test at `single-hunter-test.test.ts:79` even names this as a known pattern ("Revenge target killed immediately; queued deaths processed by dayAction") — a behavior preserved by the day-vote port. This plan fixes the double-emit without losing the `HUNTER_REVENGE` DeathInfo needed for the dawn death announcement.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/core/game.ts:524-543` — `killHunterRevenge`:
  ```ts
  killHunterRevenge(sid: string) {
    const player = this.players.get(sid);
    const hunterSid = this.getSpecialRolePlayer('HUNTER')?.getSocketId();

    if (!player) { throw new Error(...); }
    if (!hunterSid) { throw new Error(...); }

    this.deathManager.addHunterRevenge(sid, hunterSid);  // queues
    this.handlePlayerDeath(player);                     // kills + emits immediately
  }
  ```

- `apps/server/src/core/game.ts:421-479` — `processPendingDeaths()` pass 2:
  ```ts
  for (const pendingDeath of allDeaths) {
    const player = this.players.get(pendingDeath.playerId);
    if (!player) { throw new Error(...); }

    const deathInfo: DeathInfo = {
      playerId: pendingDeath.playerId,
      playerName: player.getName(),
      cause: pendingDeath.cause,
      timestamp: new Date(),
      ...(pendingDeath.metadata ? { metadata: pendingDeath.metadata } : {}),
    };
    deathInfos.push(deathInfo);
    this.handlePlayerDeath(player);              // ← re-kills + re-emits
    this.deathManager.removePendingDeath(pendingDeath.playerId);
  }
  ```

- `apps/server/src/core/player.ts:61-68` — `Player.kill()`:
  ```ts
  kill() {
    this.isAlive = false;
    this.io.to(this.socketId).emit('alert:player-is-dead');
    this.io.emit('lobby:player-died', this.socketId);
    console.log(`💀 Player ${this.name} (${this.socketId}) has been killed`);
  }
  ```

- `apps/server/src/core/game.ts:515-522` — `handlePlayerDeath(player)`:
  ```ts
  handlePlayerDeath(player: Player) {
    player.kill();
    if (player.getRole() === 'WITCH') {
      this.witchHasHealPotion = false;
      this.witchHasPoisonPotion = false;
    }
  }
  ```

- Reference existing test: `apps/server/src/__tests__/single-hunter-test.test.ts:79` — acknowledges the double-emit pattern today.

### Repo conventions to follow

- `DeathInfo` generation must still happen for the dawn announcement (the whole point of queueing `HUNTER_REVENGE` was to let `dayAction` report the revenge death with its cause + metadata).
- The cleanest fix: in `processPendingDeaths` pass 2, **skip the `handlePlayerDeath` call for entries where `!player.isAlive`** (already-killed entries), but still build and push the `DeathInfo` and still `removePendingDeath`. That preserves the death-announcement data while preventing the double-emit.
- Match the codebase's existing early-`continue` style (used in `processPendingDeaths` pass 1).
- Tests: the `single-hunter-test.test.ts:79` pattern that expects the double-emit is a regression — update it to assert only one emit, matching reality after the fix.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |
| Full hunt | `grep -n "alert:player-is-dead\|lobby:player-died" apps/server/src/__tests__/single-hunter-test.test.ts` | locate existing assertions to update |

## Scope

**In scope**:
- `apps/server/src/core/game.ts` — guard `processPendingDeaths` pass 2 against re-killing already-dead players.
- `apps/server/src/__tests__/single-hunter-test.test.ts` — update the test that expects the double-emit to expect a single emit.

**Out of scope**:
- `apps/server/src/core/game.ts:524-543` `killHunterRevenge` itself — don't change its "queue + kill" pattern; the immediate kill is the right behavior (the hunter's revenge shot resolves immediately, the segment shouldn't see the target "die at dawn"). The bug is on the `processPendingDeaths` side.
- `apps/server/src/server/night-dawn-resolution.ts` — calls `killHunterRevenge`; don't change its call site; the fix at `processPendingDeaths` handles the downstream duplicate.
- The mobile duplicate `alert:player-is-dead` handler — that's a separate client-side cleanup (= plan 011's listener leak fix); this plan removes the server-side cause.

## Git workflow

- Branch: `advisor/008-fix-killHunterRevenge-double-kill`
- Conventional commits — e.g. `fix: skip already-dead players in processPendingDeaths to prevent double emit`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Skip already-dead players in `processPendingDeaths` pass 2

In `apps/server/src/core/game.ts`, inside `processPendingDeaths`, modify pass 2's loop body to skip the `handlePlayerDeath` call when the player is already dead, while preserving the `deathInfo` generation + `removePendingDeath`:

```ts
for (const pendingDeath of allDeaths) {
  const player = this.players.get(pendingDeath.playerId);

  if (!player) {
    throw new Error('error: player not found in processPendingDeaths');
  }

  const deathInfo: DeathInfo = {
    playerId: pendingDeath.playerId,
    playerName: player.getName(),
    cause: pendingDeath.cause,
    timestamp: new Date(),
    ...(pendingDeath.metadata ? { metadata: pendingDeath.metadata } : {}),
  };
  deathInfos.push(deathInfo);

  // Skip the kill/emit side effects for players already killed directly
  // (e.g. killHunterRevenge kills immediately AND queues a HUNTER_REVENGE
  // entry for the dawn announcement — we still need the DeathInfo, but we
  // must not emit alert:player-is-dead / lobby:player-died a second time).
  if (!player.isAlive) {
    this.deathManager.removePendingDeath(pendingDeath.playerId);
    continue;
  }

  this.handlePlayerDeath(player);
  this.deathManager.removePendingDeath(pendingDeath.playerId);
}
```

Notes:
- Keep the deathInfo generation BEFORE the `isAlive` check — the death announcement (`dayAction` → `announceNightDeaths` at `game-actions.ts:109-117`) needs every pending death regardless of when the player actually died.
- The `removePendingDeath` call appears twice — duplication is intentional to keep the diff minimal; an alternative is to refactor to a single try/finally, but that's not necessary for this fix. Keep both.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Update `single-hunter-test.test.ts` to expect a single emit

In `apps/server/src/__tests__/single-hunter-test.test.ts`, find the assertion at ~line 79 that documents the double-emit ("Revenge target killed immediately; queued deaths processed by dayAction"). Update the test so:

- The mobile-equivalent `alert:player-is-dead` emit count for the revenge target is **1** (or 0 if the test asserts at a different layer — read the test for the actual pattern).
- The `lobby:player-died` emit count for the revenge target is **1**.
- The `deathInfos` returned by `processPendingDeaths` for the `HUNTER_REVENGE` cause still includes the revenge target's DeathInfo (with cause `HUNTER_REVENGE` and `metadata.hunterId`).

Read the test fully before editing — model the expected-deaths assertions on the existing test's style (likely `vi.fn()` + `expect(...).toHaveBeenCalledTimes(N)` or `expect(...).toHaveBeenCalledWith(...)`).

**Verify**: `pnpm --filter server test:run -- single-hunter` → passes with updated counts.

### Step 3: Make sure night-dawn scenarios still pass

The night-dawn-resolution flow uses `killHunterRevenge` and then `dayAction` to flush pending deaths. After the fix, the revenge target gets one emit, not two. Existing tests in `apps/server/src/__tests__/night-dawn-scenarios.test.ts` may also assert emit counts — read them and update only if they explicitly count the old double emit. Don't touch tests that don't care about emit count.

**Verify**: `pnpm --filter server test:run -- night-dawn` → passes.

### Step 4: Full suite

**Verify**: `pnpm --filter server test:run` → all tests (56 original minus any removed duplicates + updated passing). No regressions.

## Test plan

- Updated test in `single-hunter-test.test.ts`: same scenario, updated emit counts (revenge target gets `alert:player-is-dead` exactly once; `lobby:player-died` for that sid exactly once; `deathInfos` array includes the `HUNTER_REVENGE` entry).
- Add (or update) one assertion that downstream `announceNightDeaths` receives the `HUNTER_REVENGE` `DeathInfo` (cause + metadata) — this is the prove-was-queueing-still-happens check.
- If existing night-dawn tests assert emit counts, update them with identical logic.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0
- [ ] `grep -n "if (!player.isAlive)" apps/server/src/core/game.ts` returns a match inside `processPendingDeaths` pass 2 (the new guard)
- [ ] `single-hunter-test.test.ts` asserts the revenge target's `alert:player-is-dead` emit count is 1 (not 2)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Code at `game.ts:524-543` or `421-479` doesn't match "Current state" (drifted).
- The existing `single-hunter-test.test.ts:79` assertion structure is materially different from what's described (e.g. it counts via `expect.toHaveBeenCalled` with specific argument shapes that don't neatly map to "count 1 not 2"). Report what the test actually does — the fix intent stays the same but the test update may need to follow a different assertion pattern.
- An existing `night-dawn-scenarios.test.ts` test breaks in a way that's NOT just the emit count (e.g. it depends on the second `handlePlayerDeath` call running the WITCH-potion-clear side effect). Report — the side effect was being incorrectly run twice on revenge victims; if the code path actually needs the second side-effect pass for the WITCH case, that means a real WITCH also got HUNTER_REVENGE in the same pending-death pass and needs a per-cause guard instead of a blanket `!player.isAlive` skip — STOP and report so the plan can be refreshed.

## Maintenance notes

- After this fix, `killHunterRevenge` queues a death but doesn't rely on `processPendingDeaths` to actually kill the player — it kills immediately. The queue entry exists purely to generate the `DeathInfo` for announcement. If a future plan wants all deaths to flow through the queue uniformly (instead of this "kill immediately + queue for announcement only" pattern), it needs to change `killHunterRevenge` to ONLY queue (defer the kill to dawn). This plan deliberately preserves the immediate-kill UX: the mobile hunter pick should immediately reflect that the target died — the dawn announce is just narration.
- The mobile `use-game-events.ts` leak fix (plan 011) also reduces the client-side impact of duplicate emits; this plan removes the server-side cause so both fixes are independent improvements.
- If multi-room or multi-game support is added, `processPendingDeaths` should scope to the current game's `pendingDeaths` map (today `DeathManager` is per-game).