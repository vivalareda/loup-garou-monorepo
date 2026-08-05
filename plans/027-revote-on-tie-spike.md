# Plan 027: Design spike — revote-on-tie instead of "nobody-dies" (needs mobile UI)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/events-actions.ts packages/types/src/event.ts apps/mobile/hooks/use-game-events.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L (multi-day; design + implementation across server and mobile)
- **Risk**: MED (extends the just-landed Deferred-resolution program; nobody-dies is currently load-bearing for test scenarios)
- **Depends on**: plan 024 (mobile `day:voting-phase-start` — the modal UX entry point this builds on)
- **Category**: direction (design spike)
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

Day-vote ties currently resolve to **nobody dies** — `events-actions.ts:53-61` emits `day:vote-tie` and advances to night. This is explicitly parked in `PLAN.md:90` ("Revote-on-tie instead of nobody-dies (needs mobile UI)") and `plans/README.md:26`. Social-deduction games need a tie-break: nobody-dies gives werewolves a free round and can stall the game toward a draw loop. Players expect either a single revote (with surviving tied players only, or with the full village) or a tie-break rule (random elimination of one tied player, per classic Loup-Garou).

This is a **design spike**, not a build-everything plan. The output is (1) a written decision on the tie-rule contract, (2) a server-side revote-or-resolve loop, and (3) a mobile `day:vote-tie` UI. The plan scopes the investigation and proposes the API; the maintainer signs off on the rule before broad implementation.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/server/events-actions.ts:53-64` — the current tie path:
  ```ts
  if (result.kind === 'tie') {
    console.log(
      `☀ Day vote tie between: ${result.tiedPlayerNames.join(', ')} — nobody dies`
    );
    this.game.clearDayVotes();
    this.io.emit('day:vote-tie', result.tiedPlayerNames);
    await this.segmentsManager.advanceSegment({ playEndAudio: false });
    return;
  }
  await this.dayVoteResolution.run(result.player);
  ```

- `apps/server/src/core/game.ts:623-650` — `getDayVoteResult()`: returns `{ kind: 'tie', tiedPlayerNames }` when ≥2 players share the max vote count.

- `packages/types/src/event.ts:60` — `'day:vote-tie': null as unknown as (tiedPlayerNames: string[]) => void`.

- `apps/mobile/hooks/use-game-events.ts` — no `day:vote-tie` listener exists (`rg -n "day:vote-tie" apps/mobile` returns no matches today, before plan 024 lands).

- `apps/server/src/server/day-vote-resolution.ts` — the Effect program already runs after a non-tie elimination. The revote loop doesn't need to modify this file's external flow — it just needs to re-arm `clearDayVotes` and re-emit `day:voting-phase-start` (or a new `day:revote-phase-start`) until non-tie or the tie-break fires.

- Existing test: `apps/server/src/__tests__/day-vote-scenarios.test.ts:217` — exercises the tie/nobody-dies path.

### Reference rule (classic Loup-Garou)

On migration from boardgame: tie = one revote. If still tied, the tied players (or the village) lives — or the leader breaks the tie. The repo has no leader role, so a "single revote, then random elimination of one tied player" or "two revotes, then nobody dies" are both reasonable. Plan output: one rule, justified.

## Scope

**In scope** (the deliverable):
- A decision document at the top of this written plan (or in a `notes.md` addendum approved by the maintainer) naming the chosen tie rule, the revote count, what happens after the revote fails, and what the mobile UI renders.
- **Spike investigation** (this plan), NOT broad implementation. At the end of execution, the plan should produce:
  1. An updated `events-actions.ts` with a single-revote hook (or two-revote) as decided.
  2. A `day:vote-tie` mobile listener and a simple modal explaining the tie and prompting a new vote.
  3. A typed `day:revote-phase-start` event if the rule prefers this distinct from `day:voting-phase-start` (so the mobile UI can hint "Revote — X and Y are tied").
  4. Updated/existing day-vote-scenarios tests for the tie-revote loop (replacing the current nobody-dies test's expectation).
  5. New mobile handling for `day:vote-tie` (server currently emits names, mobile needs to render them).

**Out of scope**:
- A vote-history / who-voted-what UX (separate plan).
- Any change to victory conditions beyond what the tie rule implies.
- The witch/lover interplay with tie-break (the current flow targets one player via `dayVoteResolution.run(player)`; a revote doesn't change that — the resolution still runs for the surviving tie-break target).

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0              |
| Tests     | `pnpm --filter server test:run`         | updated tie tests pass |
| Mobile types | `pnpm --filter mobile tsc --noEmit`  | exit 0              |

## Git workflow

- Branch: `advisor/027-revote-on-tie-spike`
- Conventional commits — e.g. `feat: replace day-vote nobody-dies with single revote on tie`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide the tie rule (decision document required)

Pick ONE:

- **Option A (recommended): single revote, then random elimination of one tied player.** Best in spirit with classic Loup-Garou; keeps the game progressing.
- **Option B: two revotes, then nobody dies.** Matches "stalemate is suspicious; the discussion continues another night" interpretation.
- **Option C: tied players are reduced to a 2-player vote across the village; tie again = random pick.**

Record the chosen rule in your final report. The maintainer signs off before Step 2 begins — surface the decision, don't implement silently.

**STOP condition**: do not proceed to Step 2 until the rule is decided and recorded in your report. The simplest implementation continues with Option A.

### Step 2: Update `events-actions.ts` to loop or tie-break

For Option A (single revote), modify `handleDayVote`:

```ts
async handleDayVote(voterSid: string, targetPlayer: string) {
  this.game.handleDayVote(voterSid, targetPlayer);

  if (!this.game.hasAllPlayersVoted()) {
    return;
  }

  const result = this.game.getDayVoteResult();

  if (result.kind === 'tie') {
    if (this.revoteCount < 1) {
      this.revoteCount += 1;
      this.game.clearDayVotes();
      this.io.emit('day:vote-tie', result.tiedPlayerNames);
      this.io.emit('day:revote-phase-start', result.tiedPlayerNames);
      return; // wait for new votes
    } else {
      // Tie-breaker after one revote failed: random elimination of one tied player
      const targetSid = this.randomTiedSid(result.tiedPlayerNames);
      const player = this.game.getPlayerBySocketId(targetSid);
      if (!player) return;
      this.game.clearDayVotes();
      this.io.emit('day:vote-tie-final', { tiedPlayerNames: result.tiedPlayerNames, eliminatedSid: targetSid });
      await this.dayVoteResolution.run(player);
      return;
    }
  }

  this.revoteCount = 0; // reset for next day
  await this.dayVoteResolution.run(result.player);
}
```

Add `private revoteCount = 0;` and `private randomTiedSid(names: string[]): string` helper — maps names back to sids (since `tiedPlayerNames` contains names, we need to re-resolve; let `Game` provide this). Either:
- Modify `getDayVoteResult()` to ALSO return `tiedPlayerSids` (preferred — the server should not assume name→sid uniqueness).
- Or add a `Game.findSidForName(name): string` helper.

Also reset `revoteCount = 0` on game start / segment advance so the next day starts clean. Track this — add to the `clearDayVotes` call's sibling.

### Step 3: Update typed events in `packages/types/src/event.ts`

- Add `'day:revote-phase-start': (tiedPlayerNames: string[]) => void` to `ServerToClientEvents`.
- Add `'day:vote-tie-final': (payload: { tiedPlayerNames: string[]; eliminatedSid: string }) => void` to `ServerToClientEvents`.

Keep the existing `'day:vote-tie'` entry — it signals the initial tie to clients.

### Step 4: Mobile listens

In `apps/mobile/hooks/use-game-events.ts`:

- `day:vote-tie` → show a brief "tie" modal/notice for N seconds (info, not blocking) OR follow up directly with `day:revote-phase-start`. The two events fire consecutively, so the revote starts a fresh modal cycle.
- For Option A, when `day:revote-phase-start` fires: call `setModalState({ type: 'DAY-VOTE', open: true })` (or a `DAY-REVOTE` variant that visually distinguishes "revote — X and Y are tied, choose again").
- `day:vote-tie-final` → show a "tie-breaker resolved" notice, then the death-screen flow picks up via `alert:player-is-dead`.

Add matching `socket.off(...)` in cleanup.

### Step 5: Update tests

`apps/server/src/__tests__/day-vote-scenarios.test.ts:217` — the current "tie nobody-dies" test. Rewrite to assert:
1. First tie → `day:revote-phase-start` emitted.
2. Second tie (simulated by re-populating `dayVotes` and calling `handleDayVote` again) → `day:vote-tie-final` emitted with a chosen `eliminatedSid` from the tied set.
3. The chosen sid's player enters the elimination resolution (the day-vote-resolution Effect runs for them).

Model the vector of new votes on the existing `simulateAllDayVotes` pattern.

### Step 6: Mobile UI for revote

In `apps/mobile/app/(game)/game-interface.tsx`, add a `DAY-REVOTE` modal variant OR an info-banner overlay showing the tied player names before the regular `DAY-VOTE` modal opens.

Match the existing modal-system pattern; keep the diff small.

### Step 7: Full suite + manual

`pnpm --filter server test:run` → all pass, including updated tie tests.
`pnpm --filter mobile tsc --noEmit` → exit 0.
Manual: use dashboard mock to simulate a double tie — verify in mobile flow that the revote opens and the tie-break resolves.

## Test plan

- Updated `day-vote-scenarios.test.ts` tie tests: 2-3 cases (first-tie-→revote-emitted, second-tie-→tie-breaker-emitted, first-revote-succeeds-→normal-elimination).
- A new mobile vitest test (if plan 018 has landed) asserting the listener calls `setModalState` correctly for `day:revote-phase-start`.
- Manual smoke: trigger a tie in a real session via dashboard mocks.

## Done criteria

ALL must hold:

- [ ] The tie-rule decision is recorded in the final report (signed off by maintainer).
- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 with the updated tie tests
- [ ] `packages/types/src/event.ts` contains `day:revote-phase-start` and (for Option A) `day:vote-tie-final`
- [ ] `apps/mobile/hooks/use-game-events.ts` has listeners for `day:vote-tie`, `day:revote-phase-start`, and (Option A) `day:vote-tie-final`, each paired with `socket.off(...)` in cleanup
- [ ] `pnpm --filter mobile tsc --noEmit` exits 0
- [ ] Manual smoke recorded in NOTES
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1's tie-rule decision can't be reached without maintainer input — STOP, surface Options A/B/C and wait.
- `getDayVoteResult()` needs to return `tiedPlayerSids` (not just names) for the tie-breaker to work; if the maintainer prefers names-only and the current `Game.getPlayerBySocketId` lookup doesn't reverse from name → sid cleanly (since names can duplicate or be ambiguous), STOP and add the sid-return — the audit identified player-identity ambiguity as a real risk.
- The `dayVoteResolution.run(player)` pattern from Step 2 doesn't compose with the revote restart (e.g. the resolution's internal state isn't safe to call twice from the same segment) — STOP and confirm `clearDayVotes` fully resets what's needed.
- The mobile modal system doesn't support the `DAY-REVOTE` variant cleanly (= plan 025 also ruled STOP on new modal types) — STOP and reuse `DAY-VOTE` with an extra `tiedPlayerNames` data slot.
- Two revotes is too complex to land in a single spike without a vote-history UI — split into a follow-up plan after only Step 2 + Step 3 + a placeholder mobile "revote happens, please wait" listener.

## Maintenance notes

- The `revoteCount` is component-private to `EventsActions`; if `EventsActions` is recreated per game (= `initGame` in `index.ts`), the counter naturally resets per game. Confirm.
- The tie-rule chosen here should be documented in `DOCUMENTATION.md` after landing; the current tie-documentation says "nobody-dies" and will become stale.
- A vote-history / who-voted-what feature would benefit from a structured `VoteRecord[]` on the server, populated by `handleDayVote`. Out of scope here; flagged for a future direction plan.
- The random-tiebreak in Option A uses `Math.random` — for a deterministic seed-based replay (testing), consider extracting a small `pickRandomIn(array, rng)` helper. Maintenance note, not required for this spike.
- If future plans introduce a "leader" or "mayor" role (one of the documented "Future Enhancements" roles), revisit the tie rule: the leader is the tie-breaker in classic Loup-Garou; this plan's random elimination would be deprecated at that time.