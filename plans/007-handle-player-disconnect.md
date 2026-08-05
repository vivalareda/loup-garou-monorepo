# Plan 007: Handle player disconnect — remove from vote maps and re-check game state so the game doesn't deadlock

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
- **Risk**: MED (changes player-lifecycle behavior; alive counts and win conditions affect downstream segments)
- **Depends on**: none (plan 006 is independent — both touch `server-events.ts` but in different handlers; merge conflicts are trivial)
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The `disconnect` handler in `server-events.ts:51-53` just `console.log`s. The
leaver remains in `Game.players`, `DeathManager.teamWerewolves` /
`teamVillagers`, `Game.werewolfVotes`, `Game.dayVotes`,
`Game.specialRolePlayers`, and `Game.lovers`. If the leaver was a werewolf,
`hasAllWerewolvesAgreed()` (`game.ts:353`) waits on their socket ID forever
and the werewolf phase deadlocks. Same for day votes
(`hasAllPlayersVoted()` at `game.ts:610-621`). If the leaver held CUPID,
WITCH, or HUNTER, `cupidAction()` emits to a dead socket and the segment
never advances. There is no recovery path short of 'r' restart (plan 005)
or server restart. In a real-time mobile game where network drops are
common, this stalls sessions permanently.

**Critical design choice: this plan treats disconnect as death, not as
removal.** Removing a player mid-game changes alive counts (affecting
`checkIfWinner()`) and would silently alter the game's outcome. Treating
them as dead — broadcasting `alert:player-is-dead` / `lobby:player-died`
and re-checking winner — keeps the game completable while preserving
team/winner semantics. The leaver's role stays in `specialRolePlayers` so
e.g. a disconnected Hunter still triggers the revenge flow's
`hunterIsInDeathQueue` check.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/server/server-events.ts:51-53` — the disconnect no-op:
  ```ts
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
  });
  ```

- `apps/server/src/core/game.ts:481-483` — `getAlivePlayers()` returns players filtered by `isAlive`; disconnected players still `isAlive: true` today.

- `apps/server/src/core/game.ts:348-362` — `hasAllWerewolvesAgreed()` checks every werewolf socket ID is in `werewolfVotes`; a disconnected werewolf's vote never arrives.

- `apps/server/src/core/game.ts:610-621` — `hasAllPlayersVoted()` compares `dayVotes.size` to the count of alive players. A disconnected player who didn't vote blocks resolution forever.

- `apps/server/src/core/game.ts:515-522` — `handlePlayerDeath(player)` calls `player.kill()` which sets `isAlive: false` and emits `alert:player-is-dead` + `lobby:player-died`. Exactly the desired UX.

- `apps/server/src/core/game.ts:686-713` — `checkIfWinner()` already counts alive players on each team. Treating disconnect as death means `checkIfWinner` naturally re-evaluates.

- `apps/server/src/core/game.ts:259-263` — `handleDayVote` stores votes by `voterSid`. If a voter disconnects mid-vote, their stale vote stays but no longer counts because they're not alive (= plan 006 already rejects future votes from dead voters).

- `apps/server/src/core/player.ts:61-68` — `Player.kill()` emits to the dead socket too; for a disconnected socket those emits are silent (no crash) — safe to reuse.

### Repo conventions to follow

- `Player.kill()` is the canonical death path (emits the two events). Prefer calling it via `Game.handlePlayerDeath` over duplicating the emit logic.
- Existing in-handler logging uses emoji prefixes on admin events, plain `console.log`/`console.warn` else. Match.
- Don't throw from socket handlers — log + return.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/server/server-events.ts` — the `disconnect` handler.
- `apps/server/src/core/game.ts` — add a small public `handleDisconnect(socketId)` method that does the kill + vote-map cleanup + winner re-check, so the handler is thin and the logic is testable.

**Out of scope**:
- `DeathManager` — its teamWerewolves/teamVillagers lists accept players as they join; we won't filter those lists here (alive checks downstream already work off `isAlive`). If a future plan needs team-counts to drop, address there.
- Re-adding a player on reconnect — out of scope (the game has no reconnect flow; once dead, the player stays dead).
- The Effect `index.effect.ts` disconnect handler — out of scope (dead code; planned separately).

## Git workflow

- Branch: `advisor/007-handle-disconnect`
- Conventional commits — e.g. `fix: treat player disconnect as death to prevent game deadlocks`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `Game.handleDisconnect(socketId)`

In `apps/server/src/core/game.ts`, add a public method near `handlePlayerDeath`:

```ts
handleDisconnect(socketId: string) {
  const player = this.players.get(socketId);
  if (!player) {
    return; // unknown socket (never joined as a player) — nothing to do
  }

  // Only act if the player is currently alive (avoid re-kill on a double
  // disconnect emitted by the socket.io adapter)
  if (!player.isAlive) {
    return;
  }

  console.log(`Player ${player.getName()} (${socketId}) disconnected — treating as death`);

  // Mark dead + emit alert:player-is-dead / lobby:player-died via Player.kill
  this.handlePlayerDeath(player);

  // Stale vote cleanup — both maps
  this.werewolfVotes.delete(socketId);
  this.dayVotes.delete(socketId);

  // If one of the lovers disconnected, treat the partner as dying of grief
  // (PARTNER_SUICIDE) so the lovers mechanic doesn't leave a half-broken bond.
  if (this.isPlayerLover(player)) {
    const partner = this.getPartner(player);
    if (partner?.isAlive) {
      this.deathManager.addPartnerSuicide(
        partner.getSocketId(),
        player.getSocketId()
      );
    }
  }
}
```

Notes:
- Don't call `processPendingDeaths()` here — the caller doesn't know what segment we're in; `dayAction()` is the scheduled flush and will pick up the PARTNER_SUICIDE if it's night/dawn (night-dawn-resolution.ts already iterates the queue at dawn). For mid-day disconnect, the partner grief death should be queued; if the day is already over, `processPendingDeaths` runs at the next dawn. If this introduces a visible UX issue for the day case, a follow-up plan should evaluate killing the partner immediately; for this plan, queueing matches the existing night-lover-death semantics.
- Don't re-check `checkIfWinner` here — the segments manager already does it at each phase transition (`playSegment`/`finishSegment`); a mid-segment kill doesn't need to interrupt. If, after this plan lands, a playtest shows that a disconnect that leaves werewolves at parity should end the game immediately, a follow-up plan will add a `segmentsManager.isGameOver()`-style interrupt — out of scope here.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Wire the `disconnect` handler to call `Game.handleDisconnect`

In `apps/server/src/server/server-events.ts`, the `disconnect` handler at lines 51-53:

```ts
socket.on('disconnect', () => {
  console.log('Player disconnected:', socket.id);
  this.game.handleDisconnect(socket.id);
});
```

That's it — no winner re-check call here; the segment loop handles it.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Add tests for the disconnect path

In `apps/server/src/core/__tests__/game.test.ts` (or a new `disconnect.test.ts` in the same folder — match wherever existing `Game` unit tests live; the existing `game.test.ts` is the exemplar), add tests:

1. **disconnect of an alive player with no role interactions** — `handleDisconnect(sid)` → player `isAlive` is false, `alert:player-is-dead` and `lobby:player-died` were emitted exactly once each.
2. **disconnect of a werewolf mid-vote** — seat one werewolf, register a vote for target X, call `handleDisconnect(werewolfSid)`. Assert `werewolfVotes` no longer contains that sid; assert `hasAllWerewolvesAgreed()` no longer deadlocks on the absent sid (returns false if other werewolves remain unvoted, true if all remaining werewolves have agreed).
3. **disconnect of a player mid-day-vote** — seat two alive voters; one votes; call `handleDisconnect(unvotedSid)`. Assert `dayVotes` no longer contains the disconnected sid; assert `hasAllPlayersVoted()` returns true only when the remaining alive voters have voted (the dead voter's stale sid isn't counted in the alive check; this should fall out naturally because the expected-voters count already filters `player?.isAlive` at `game.ts:613-618`).
4. **disconnect of a lover** — seat two lovers, call `handleDisconnect(lover1Sid)`. Assert `isOneOfLoversInDeathQueue()` returns true (the partner got `PARTNER_SUICIDE` queued).
5. **disconnect of an already-dead player** — kill a player first, then `handleDisconnect(sid)` — assert no second `alert:player-is-dead` / `lobby:player-died` emit (idempotent guard).
6. **disconnect of an unknown socket** — call `handleDisconnect('not-a-real-sid')` → no throws, no emits.

Model each test after the existing `Game` + mock `io` pattern in `game.test.ts`. Read those tests before writing yours.

**Verify**: `pnpm --filter server test:run -- disconnect` → all new tests pass.

### Step 4: Full suite

**Verify**: `pnpm --filter server test:run` → all existing 56 + new tests pass. If an existing scenario test broke because a mock-socket-scenario now triggers `handleDisconnect` for an intentional disconnect mid-test — see STOP conditions.

## Test plan

See Step 3 — six new tests in `apps/server/src/core/__tests__/game.test.ts` (or sibling `disconnect.test.ts`). All follow the existing `Game` + mock `io` harness. Add a regression test name like `disconnecting mid-werewolf-vote does not deadlock` that would have failed before the fix.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0; new disconnect tests exist and pass
- [ ] `grep -n "handleDisconnect" apps/server/src/core/game.ts` returns one match (the new method)
- [ ] `grep -n "this.game.handleDisconnect" apps/server/src/server/server-events.ts` returns one match (in the `disconnect` slot)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `server-events.ts:51-53` or `game.ts:515-522` is not what "Current state" describes (drifted since this plan was written).
- An existing scenario test depends on `disconnect` being a no-op (e.g. a mock socket that disconnects mid-scenario but the scenario expects all players to remain). Report the test — likely the test needs to update its alive/player-count expectations; don't silently weaken the real fix.
- You discover that `Player.kill()` or `handlePlayerDeath` ALSO removes from `players`, `specialRolePlayers`, or `lovers` (so the partner-suicide or special-role-block lookahead would break). Report — this plan's logic assumes `kill()` only sets `isAlive: false` and emits, not registry removal.
- The night-dawn-resolution's dawn flow miscounts when a `PARTNER_SUICIDE` was queued earlier via disconnect and re-queues it via the normal cascade — report any double-entry so the plan can add a guard.

## Maintenance notes

- The Effect entry (`index.effect.ts`) doesn't wire disconnect handling at all today — when that path goes live, port this handler.
- A reconnect flow (out of scope here) would need to differentiate "intentional dead" players from "disconnected but should be allowed to rejoin". For now dead means dead.
- If multi-room support lands, `handleDisconnect` should scope to a room; today the server runs one game so the global `players` map is fine.
- A follow-up plan should address the UX of mid-day disconnect: a player dropping mid-vote currently can't be communicated to other players without endgame re-check. If playtests reveal issues, add a `socket.broadcast.emit('lobby:player-disconnected', socketId)` distinct from `lobby:player-died`. Don't conflate with this plan.