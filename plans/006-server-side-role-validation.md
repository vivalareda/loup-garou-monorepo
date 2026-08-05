# Plan 006: Add server-side role validation on cupid / witch / hunter / day-vote socket events

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/server-events.ts apps/server/src/core/game.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (additive guards; pattern already exists for werewolf voting)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The werewolf vote handlers validate the sender's role server-side (`Game.handleWerewolfVote` throws if `!isWerewolf(voterSid)` — `game.ts:244-248`). None of the other special-role handlers do. A client using browser devtools or a malicious script can impersonate any role:

- `cupid:lovers-pick` — any client can force any two players to be lovers.
- `witch:healed-player` / `witch:skipped-heal` — any client can heal the werewolf victim, burning the real witch's one-time potion.
- `witch:poisoned-player` / `witch:skipped-poison` — any client can poison any player or skip the witch's turn.
- `witch:skipped-heal` / `witch:skipped-poison` — any client can advance the game segment by skipping the witch entirely.
- `hunter:killed-player` — any client can fire the hunter's revenge shot.
- `day:player-voted` — any client (including dead players) can cast a day-vote that's counted in `hasAllPlayersVoted()`'s size check, triggering premature resolution.

Combined with the open CORS policy (separate plan 023), this is exploitable from any web origin.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/server/server-events.ts:112-117` — cupid handler: `socket.on('cupid:lovers-pick', (selectedPlayers) => { this.game.setLovers(selectedPlayers); this.segmentsManager.finishSegment(); })`. No check that `socket.id` is the cupid.
- `apps/server/src/server/server-events.ts:150-171` — witch handler block:
  ```ts
  socket.on('witch:healed-player', () => {
    this.game.healWerewolfVictim();
    this.segmentsManager.finishSegment();
  });
  socket.on('witch:poisoned-player', (playerSid: string) => {
    this.game.witchKill(playerSid);
    this.segmentsManager;       // no-op statement (separate plan 017 removes it)
    this.segmentsManager.finishSegment();
  });
  socket.on('witch:skipped-heal', () => { this.segmentsManager.finishSegment(); });
  socket.on('witch:skipped-poison', () => { this.segmentsManager.finishSegment(); });
  ```
  None check the sender is the witch or that the witch has the relevant potion.
- `apps/server/src/server/server-events.ts:184-190` — hunter handler: `socket.on('hunter:killed-player', (targetSid) => { if (!this.eventsActions.submitHunterPick(targetSid)) console.warn(...); })`. No role check.
- `apps/server/src/server/server-events.ts:176-178` — day vote handler: `socket.on('day:player-voted', (targetPlayer) => { this.eventsActions.handleDayVote(socket.id, targetPlayer); })`. No alive check.
- Reference positive example: `apps/server/src/server/server-events.ts:131-147` werewolf handlers route through `eventsActions.handleWerewolfVote` → `Game.handleWerewolfVote` (`game.ts:243-257`) which throws if `!this.isWerewolf(voterSid)`.

Existing role-access primitives:
- `Game.getSpecialRolePlayer(role: Role)` (`game.ts:96-97`) returns `Player | undefined`.
- `Player.getSocketId()` (`player.ts:53-55`) returns the socket ID.
- `Game.getPlayerBySocketId(socketId)` (`game.ts:229-231`) returns `Player | undefined`.
- `Player.isAlive` (`player.ts:14`) is a public boolean.
- `Game.canWitchHeal()` / `Game.canWitchPoison()` (`game.ts:592-598`) are public booleans.

### Repo conventions to follow

- Server-side validation pattern: throw inside the `Game`-layer method (as `handleWerewolfVote` does) OR guard inline in `server-events.ts`. The cleaner pattern is a small helper that returns `boolean` — but to match the existing werewolf precedent, prefer **guards inline in `server-events.ts`** that `console.warn` + `return` on mismatch. Avoid throwing from socket handlers (current werewolf code throws, but the `setupWerewolfEvents` block doesn't catch — the throw becomes an unhandled error in the io adapter).
- Match the existing `console.log`/`console.warn` logging voice used in `server-events.ts` (emoji prefixes on admin events, plain `console.warn` for the hunter fallback at line 186).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/server/server-events.ts` — add role checks in cupid, witch (×4), and hunter handlers; add alive checks in the day-vote handler.
- `apps/server/src/server/events-actions.ts` — push the voter/target alive validation into `handleDayVote` (where it belongs alongside the `hasAllPlayersVoted` check) so both call sites benefit.

**Out of scope**:
- `event-handlers.effect.ts` — dead Effect variant; separate plan.
- The no-op `this.segmentsManager;` line — plan 017 removes it; don't combine.
- Auth/session — out of scope; this plan is role-and-state validation only.
- The day-vote counted-player validation depth (counting votes by socket ID vs name) — plan covers alive Voter + alive+existent Target; beyond that is a separate plan.
- CORS hardening — separate plan (023).

## Git workflow

- Branch: `advisor/006-server-side-role-validation`
- Conventional commits — e.g. `fix: validate sender role on cupid/witch/hunter socket events`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Cupid handler — verify sender is cupid

In `apps/server/src/server/server-events.ts`, the `setupCupidEvents(socket)` method, replace the body of `cupid:lovers-pick` with:

```ts
socket.on('cupid:lovers-pick', (selectedPlayers: string[]) => {
  const cupid = this.game.getSpecialRolePlayer('CUPID');
  if (!cupid || cupid.getSocketId() !== socket.id) {
    console.warn(`cupid:lovers-pick rejected from ${socket.id} (not cupid)`);
    return;
  }
  this.game.setLovers(selectedPlayers);
  this.segmentsManager.finishSegment();
});
```

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Witch handlers — verify sender is the witch AND has the relevant potion

In `setupWitchEvents(socket)`, add a guard at the top of each potion handler. The heal variant requires `canWitchHeal()`; the poison variant requires `canWitchPoison()`:

```ts
socket.on('witch:healed-player', () => {
  const witch = this.game.getSpecialRolePlayer('WITCH');
  if (!witch || witch.getSocketId() !== socket.id || !this.game.canWitchHeal()) {
    console.warn(`witch:healed-player rejected from ${socket.id}`);
    return;
  }
  this.game.healWerewolfVictim();
  this.segmentsManager.finishSegment();
});

socket.on('witch:poisoned-player', (playerSid: string) => {
  const witch = this.game.getSpecialRolePlayer('WITCH');
  if (!witch || witch.getSocketId() !== socket.id || !this.game.canWitchPoison()) {
    console.warn(`witch:poisoned-player rejected from ${socket.id}`);
    return;
  }
  this.game.witchKill(playerSid);
  this.segmentsManager.finishSegment();
});

socket.on('witch:skipped-heal', () => {
  const witch = this.game.getSpecialRolePlayer('WITCH');
  if (!witch || witch.getSocketId() !== socket.id) {
    console.warn(`witch:skipped-heal rejected from ${socket.id}`);
    return;
  }
  console.log('🧙 Witch skipped heal action');
  this.segmentsManager.finishSegment();
});

socket.on('witch:skipped-poison', () => {
  const witch = this.game.getSpecialRolePlayer('WITCH');
  if (!witch || witch.getSocketId() !== socket.id) {
    console.warn(`witch:skipped-poison rejected from ${socket.id}`);
    return;
  }
  console.log('🧙 Witch skipped poison action');
  this.segmentsManager.finishSegment();
});
```

Don't touch the `this.segmentsManager;` no-op line — plan 017 removes it separately. For `skipped-heal`, don't require `canWitchHeal()` — the witch is allowed to skip even if she's already used the potion (this is a state guard, not a skip-blocker); only ensure the sender IS the witch.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Hunter handler — verify sender is the hunter

In `setupHunterEvents(socket)`:

```ts
socket.on('hunter:killed-player', (targetSid: string) => {
  const hunter = this.game.getSpecialRolePlayer('HUNTER');
  if (!hunter || hunter.getSocketId() !== socket.id) {
    console.warn(`hunter:killed-player rejected from ${socket.id} (not hunter)`);
    return;
  }
  if (!this.eventsActions.submitHunterPick(targetSid)) {
    console.warn(`hunter pick for ${targetSid} received but no resolution is waiting`);
  }
});
```

Note: this preserves the existing "no resolution waiting" warning behavior; the new check just adds a role gate before it.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 4: Day vote — validate voter is alive and target exists and is alive (in events-actions.ts)

In `apps/server/src/server/events-actions.ts`, modify `handleDayVote(voterSid, targetSid)`:

```ts
async handleDayVote(voterSid: string, targetPlayer: string) {
  const voter = this.game.getPlayerBySocketId(voterSid);
  if (!voter || !voter.isAlive) {
    console.warn(`day:player-voted rejected from ${voterSid} (voter not alive)`);
    return;
  }

  const target = this.game.getPlayerBySocketId(targetPlayer);
  if (!target || !target.isAlive) {
    console.warn(
      `day:player-voted rejected: target ${targetPlayer} not alive or not found`
    );
    return;
  }

  this.game.handleDayVote(voterSid, targetPlayer);

  if (!this.game.hasAllPlayersVoted()) {
    return;
  }

  // ... rest unchanged
}
```

This benefits both the live `server-events.ts` caller and any future caller. The endpoint at `server-events.ts:176-178` continues to call `handleDayVote(socket.id, targetPlayer)` without duplication.

Note: rename the param from `targetPlayer` to match semantic intent only if the existing signature uses `targetPlayer` — leave the signature itself intact to avoid touching the call site.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 5: Run the suite

**Verify**: `pnpm --filter server test:run` → all 56 pass. If a test was sending a special-role event from an unrelated socket and depending on the action going through, that test now fails — fix the test to use the actual special-role player's socket ID (don't weaken the new guard). See STOP conditions.

## Test plan

- New tests in a file like `apps/server/src/__tests__/role-validation.test.ts` (or extend an existing role/validation suite if one exists — check via `grep -rln "getSpecialRolePlayer" apps/server/src/__tests__/` first).
- Cases (one test each):
  - `cupid:lovers-pick` from a non-cupid socket → no `setLovers` call on `Game`.
  - `witch:healed-player` from a non-witch socket → no `healWerewolfVictim` call.
  - `witch:poisoned-player` from a non-witch socket → no `witchKill` call.
  - `witch:skipped-heal` from a non-witch socket → `finishSegment` not called.
  - `hunter:killed-player` from a non-hunter socket → `submitHunterPick` not called.
  - `day:player-voted` from a dead voter → vote not counted (no `hasAllPlayersVoted` flip).
  - `day:player-voted` targeting a dead/nonexistent socket → vote not counted.
- Model after the existing integration tests in `apps/server/src/__tests__/` — use the same `Game` + mock `io` harness (look for one that constructs `Game` directly; the existing `game.test.ts` is the closest exemplar).

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0; new tests for all 6 guard paths exist and pass
- [ ] `grep -n "getSpecialRolePlayer('CUPID')" apps/server/src/server/server-events.ts` returns one match inside `cupid:lovers-pick`
- [ ] `grep -n "getSpecialRolePlayer('WITCH')" apps/server/src/server/server-events.ts` returns four matches (one per witch handler)
- [ ] `grep -n "getSpecialRolePlayer('HUNTER')" apps/server/src/server/server-events.ts` returns one match inside `hunter:killed-player`
- [ ] `grep -n "isAlive" apps/server/src/server/events-actions.ts` returns matches inside `handleDayVote` for both voter and target
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Code at the cited locations doesn't match "Current state" (drift).
- An existing test breaks specifically because it was sending a special-role event from a wrong-socket mock and expecting the action to go through. The test was relying on the no-validation bug — STOP, report the test file and assertion, and fix the test to send from the actual special-role socket (do NOT remove the new guard).
- `Game.getSpecialRolePlayer` has changed signature — STOP and report.
- `Player.isAlive` is no longer a public field (e.g. was made private with a getter) — use the corresponding getter; STOP and report so the plan can be refreshed.
- A guard you add breaks a passing scenario because the witch's `skipped-*` paths unexpectedly require potion availability — STOP and report the failing test name + assertion.

## Maintenance notes

- The Effect variants (`event-handlers.effect.ts`) have the same gaps; when that path gets wired (parked Effect migration), apply the same guards.
- If multi-room support is added, `socket.id` should be tracked per-room, not globally — revisit these guards then.
- The werewolf `handleWerewolfVote` precedent throws — the new guards use `return` instead, which is safer (unhandled throws in socket.io become silent adapter errors). If a future cleanup wants to unify the style, convert the werewolf throw to a console.warn + return too — but not in this plan (avoids behavior change to existing tests).
- The CORS plan (023) defensively narrows the surface; this plan is the authoritative server-side trust boundary regardless of origin restrictions.