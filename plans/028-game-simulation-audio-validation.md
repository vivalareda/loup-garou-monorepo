# Plan 028: Rapid game simulation + audio-sequence validation

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.

## Status

- **Priority**: P2 (feature — not an advisor finding)
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (built on the existing deferred resolution + death-manager)
- **Category**: feature / test-infra
- **Planned at**: 2026-07-10 (operator request)

## Why this matters

The deterministic death-audio sequences (lover dies, hunter dies, lover+hunter,
partner-is-hunter, hunter-revenge-kills-lover) are already pinned by exact
audio assertions in `night-dawn-scenarios.test.ts` and
`day-vote-scenarios.test.ts` — one hand-crafted scenario each, with hardcoded
roles. There is **no** way today to:

- play a bunch of games **real quick** with **random role attribution**,
- run a game to completion (winner) through the real segment loop,
- assert that **every** sequence makes sense across many random games,
- guarantee the **right audio plays at the right time** whenever a lover or a
  hunter dies — at scale, not just in the hand-picked cases.

This plan adds a `GameSimulator` that drives full games (cupid → werewolf →
witch → dawn → day-vote → … → winner) with random roles and mocked audio,
records the ordered audio + emit + death logs, plus audio-invariant validators
and a property-style test that runs many random games and asserts the death
audio invariants hold every time.

## Current state

- `apps/server/src/segments/audio-manager.ts` — `playAudio(file)` is the single
  choke point for every sound; it `existsSync`s `./assets/${file}.mp3` and
  `sound.play`s. Tests mock `sound-play` (`vi.mock('sound-play', …)`) so
  `playAudio` resolves instantly; the audio file arg is captured by spying on
  `playAudio`. `DEBUG_AUDIO=1` logs `[AUDIO] Would play: <file>` instead of
  playing.
- `apps/server/src/server/night-dawn-resolution.ts` / `day-vote-resolution.ts`
  — the Effect programs that play the dawn + day-vote death audio and pause on
  a `Deferred` for the hunter pick. `EventsActions.submitHunterPick` routes a
  pick to whichever is waiting.
- `apps/server/src/segments/segments-manager.ts` — drives the segment loop:
  `startGame()` → `playSegment()` → action → (player input) →
  `finishSegment()` → `advanceSegment()` → next segment. CUPID/LOVERS are
  marked `skip` after night 1; WEREWOLF/WITCH-HEAL/WITCH-POISON/DAY repeat.
- `apps/server/src/core/game-actions.ts` `dayAction` — ends dawn with
  `setTimeout(() => io.emit('day:voting-phase-start'), 7000)`. The 7s wait
  makes rapid simulation impossible; the `day:voting-phase-start` emit is a UI
  signal with **no audio** (audio already played during the resolution).
- `apps/server/src/core/game.ts` — `werewolfVotes` is `Map<sid,sid>` that is
  **never cleared between nights** (only `clearDayVotes()` exists, only
  `handleDisconnect` deletes a single entry). After a werewolf dies (day vote
  / poison), its stale vote stays; the next night the surviving werewolf votes
  a different target and `hasAllWerewolvesAgreed()` (which checks
  `votes.every(v => v === firstVote)` over **all** values incl. stale) returns
  false forever → the game deadlocks. (The dashboard's
  `admin:simulate-werewolf-vote` hides this by re-voting for **all** werewolves
  incl. dead ones, overwriting the stale entry.)
- `apps/server/AGENTS.md` (per-package) exists; root `AGENTS.md` was added by
  plan 022. `.env.example` files were added by plan 022; maintenance notes say
  new server env vars must be documented there in the same commit.

## Scope

**In scope**:

- `apps/server/src/simulation/recording-io.ts` (new) — `RecordingIO` mock
  socket that records every `io.emit` / `io.to(sid).emit` into an ordered log.
- `apps/server/src/simulation/game-simulator.ts` (new) — `GameSimulator` +
  `RecordingAudioManager` (overrides `playAudio` to record, never plays).
  Builds the real game graph, assigns random roles, auto-drives every phase
  to a winner, exposes `audioLog` / `emitLog` / `deathLog` / `winner`.
- `apps/server/src/simulation/audio-validators.ts` (new) — invariant
  assertions over a completed simulation (completion, death-audio cues, no
  placeholder audio).
- `apps/server/src/__tests__/simulation/simulator-harness.test.ts` (new) —
  proves the harness on a few forced scenarios (incl. a multi-night game
  where a werewolf is voted out — the former deadlock).
- `apps/server/src/__tests__/simulation/random-games.test.ts` (new) — runs N
  random games (some with a forced hunter) and asserts the audio invariants.
- `apps/server/src/core/game.ts` — add `clearWerewolfVotes()` (deadlock fix)
  AND declare a werewolf win at 0 villagers (`checkIfWinner` — see Deviations).
- `apps/server/src/core/game-actions.ts` — call
  `this.game.clearWerewolfVotes()` at the top of `werewolfAction()`; make the
  `dayAction` day-vote delay configurable via `process.env.DAY_VOTE_DELAY_MS`
  (default `7000`, unchanged).
- `apps/server/.env.example` — document `DAY_VOTE_DELAY_MS`.

**Out of scope**:

- Modifying `day-vote-scenarios.test.ts` / `segments.test.ts` /
  `night-dawn-scenarios.test.ts` / `hunter-scenarios.test.ts` (must keep
  passing unchanged — they already pin the exact sequences).
- The `.effect.ts` files (dead scaffolding).
- Mobile / dashboard client changes.
- Ties (`day:vote-tie`) — the simulator votes unanimously to avoid ties; the
  tie path is covered by `day-vote-scenarios.test.ts` and plan 027.
- Fixing the dead-witch-segments-still-run quirk (witch wake-up audio plays
  after the witch dies) — recorded authentically; flagged as a follow-up.

## Git workflow

- Branch: `advisor/028-game-simulation-audio-validation`
- Conventional commits — e.g.
  `feat: add GameSimulator + audio-invariant validation across random games`
  and `fix: clear werewolf votes each night to prevent post-death deadlock`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Fix the multi-night werewolf-vote deadlock

- In `apps/server/src/core/game.ts`, add next to `clearDayVotes()`:
  ```ts
  clearWerewolfVotes() {
    this.werewolfVotes.clear();
  }
  ```
- In `apps/server/src/core/game-actions.ts` `werewolfAction()`, clear at the
  top (before emitting the prompt), so each night starts fresh:
  ```ts
  werewolfAction() {
    this.game.clearWerewolfVotes();
    for (const werewolf of this.game.getWerewolfList()) { … }
  }
  ```
  `werewolfAction` is the WEREWOLF segment entry point, so this covers every
  night; `getWerewolfTarget` (used by the witch phase) runs after votes are
  cast, so clearing before the vote is safe.

**Verify**: `pnpm --filter server test:run` → all existing tests still pass.

### Step 1.5: Declare a werewolf win at 0 villagers (grief-cascade stall)

- The production `checkIfWinner` only ended the game at 0 werewolves or a
  1-v-1. A lover-grief cascade at dawn can drop the village straight to
  "≥1 werewolves + 0 villagers" (two villagers die at once), which it
  reported as `null` → the next werewolf phase had no target and the game
  deadlocked (and no winner audio played).
- Fix (minimal, NOT the broad `werewolves >= villagers` rule — that
  short-circuits the grief cascade at 2-werewolves-+-1-villager and breaks
  `hunter-scenarios.test.ts`): in `apps/server/src/core/game.ts`
  `checkIfWinner`, after the 0-werewolves check, add:
  ```ts
  if (villagers.length === 0) {
    return 'werewolves';
  }
  ```
  `processPendingDeaths` drains the whole queue (including the grief
  cascade) before `checkIfWinner` runs in `dayAction`, so this never
  short-circuits a mid-cascade state — it only fires once the cascade is
  done.

**Verify**: `pnpm --filter server test:run` → existing 72 still pass (incl.
`hunter-scenarios`'s 2-werewolf grief-cascade case).

### Step 2: Make the day-vote delay configurable

- In `apps/server/src/core/game-actions.ts` `dayAction()`, replace the
  literal `7000` with `Number(process.env.DAY_VOTE_DELAY_MS ?? 7000)`.
- In `apps/server/.env.example`, append:
  ```
  # Optional: delay (ms) before the day-vote UI opens after dawn (default 7000).
  # Set to 0 for rapid automated simulation / headless testing.
  DAY_VOTE_DELAY_MS=7000
  ```

**Verify**: `pnpm --filter server test:run` → still green (no test sets the
env, so default 7000 = unchanged behaviour).

### Step 3: `RecordingIO` + `RecordingAudioManager`

`recording-io.ts`: a mock `SocketType` that pushes `{ scope, event, args }` to
`emits` on every `io.emit` / `io.to(sid).emit`; expose `emits`, `eventsOf(name)`,
`emitted(name)`. Cast `as unknown as SocketType` (only `to` + `emit` are called
on the paths the simulator exercises).

`RecordingAudioManager extends AudioManager` in `game-simulator.ts`: overrides
`playAudio(file)` to `audioLog.push(file)` and resolve immediately — no
`existsSync`, no `sound-play`, captures every file the real manager would have
played (including ones with no on-disk asset).

**Verify**: `pnpm --filter server check-types` → exit 0.

### Step 4: `GameSimulator`

Options (all optional, sensible random defaults):
`playerCount` (6), `forceHunterName`, `lovers` (`'random'` | `'random-with-hunter'`
| `[sidA, sidB]`), `witchHealStrategy` / `witchPoisonStrategy`
(`'always' | 'never' | 'random'`), `maxRounds` (30), `flush`
(default `() => new Promise(r => setTimeout(r, 0))`), `rng` (`Math.random`).

`setup()` builds the graph with the recorders, sets `process.env.DAY_VOTE_DELAY_MS='0'`
(saved/restored in `dispose()`), optionally `DEV_FORCE_HUNTER`, adds players,
`assignRoles()` (random), picks lovers, `setPlayerTeams` (done inside
`assignRoles`). `run()`:

1. `segmentsManager.startGame()` (CUPID audio + `cupid:pick-required`); flush;
   lovers already set → `finishSegment()` → WEREWOLF.
2. Loop while `checkIfWinner() === null && rounds < maxRounds`:
   - **werewolf**: vote one random alive non-werewolf target for every alive
     werewolf via `eventsActions.handleWerewolfVote` (auto-`finishSegment` on
     agreement).
   - **witch-heal** (if `getCurrentSegmentType() === 'WITCH-HEAL'`): heal (if
     `canWitchHeal` + strategy) or skip → `finishSegment`.
   - **witch-poison** (if `WITCH-POISON`): poison a random alive non-witch (if
     `canWitchPoison` + strategy) or skip → `finishSegment`.
   - **day**: capture `nightDawnResolution.run()` promise; flush; if
     `hunter:pick-required` emitted, `submitHunterPick(randomAlive)`; loop
     flush+pick until the promise settles (handles chained hunter picks).
     After dawn, `dayAction` ran (deaths processed, winner checked, 0ms
     `day:voting-phase-start` fired — ignored). If winner, break. Else drive
     the day vote: all alive players vote one random alive target via
     `handleDayVote`; capture the last `handleDayVote` promise; flush+pick
     until settled (the day-vote resolution + `advanceSegment` to next night).
3. `winner = checkIfWinner()`.

Expose `audioLog`, `io.emits`, `deathLog` (sids from `lobby:player-died`
ordered), `winner`, `rounds`, `error`, `players`, `roleOf(sid)`, `isLover(sid)`.

`resolveWithHunterPick(promise)` helper: attach `promise.then(() => settled =
true)`; loop `await flush()` + submit a pick whenever a new
`hunter:pick-required` appears, until `settled`; then `await promise` + flush.
This handles the recursive `resolveConsequences` chain (revenge target is a
hunter / lover).

### Step 5: `audio-validators.ts`

- `LOVER_CUES` and `HUNTER_CUES` (the files each death branch plays, gathered
  from `audio-manager.ts` / `special-scenarios.ts` / both resolutions).
- `assertCompleted(sim)` — `winner` is `'villagers'|'werewolves'`, `error`
  null, winner audio present (`End-game/Villagers-won` /
  `End-game/Werewolves-won`).
- `assertDeathAudioInvariants(sim)` — if any dead player was a lover →
  `audioLog` intersects `LOVER_CUES`; if any dead player was a HUNTER →
  intersects `HUNTER_CUES`.
- `assertNoPlaceholderAudio(sim)` — no file equals/contains
  `'not implemented'` (guards `getSegmentStartAudio('HUNTER')` leaking).

### Step 6: Tests

`simulator-harness.test.ts` — `vi.mock('sound-play')`; deterministic:
- a 6-player game with a forced hunter + forced hunter-lover → completes,
  hunter died → a `HUNTER_CUE` present, lover died → a `LOVER_CUE` present;
- a multi-night game where the village votes a werewolf out → the next night
  completes (the former deadlock) — `rounds > 1` and `winner` set.

`random-games.test.ts` — runs e.g. 40 random games (half with
`forceHunterName`, lovers `'random'` / `'random-with-hunter'`); for each:
`assertCompleted`, `assertDeathAudioInvariants`, `assertNoPlaceholderAudio`.
Seeded by `Math.random` (non-deterministic on purpose — broad coverage; a
failure prints the seed-relevant role/lover layout for reproduction).

**Verify**: `pnpm --filter server test:run` → all green (existing 72 + new).

### Step 7: Whole-workspace gate

**Verify**: `pnpm check-types` → exit 0 across all 4 packages.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server test:run` exits 0 (existing tests unchanged + new)
- [ ] `pnpm check-types` exits 0
- [ ] `GameSimulator` runs a random 6-player game to a `winner` without
  throwing (proven by `random-games.test.ts`)
- [ ] a multi-night game where a werewolf is voted out completes (deadlock fix)
- [ ] whenever a lover died in a random game, a `LOVER_CUE` is in `audioLog`;
  whenever a hunter died, a `HUNTER_CUE` is (asserted across all random games)
- [ ] `grep -n "DAY_VOTE_DELAY_MS" apps/server/.env.example` matches
- [ ] no files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- Any existing test fails after Step 1 or Step 2 — revert the production
  change and report which test regressed.
- `RecordingAudioManager` overriding `playAudio` misses audio played by
  methods that call `playAudio` via a bound reference rather than `this.` —
  confirm `this.playAudio` dispatches to the override (it does; all
  `audio-manager` methods use `this.playAudio` / `await this.playAudio`).
- The dawn / day-vote `Deferred` does not resume under real timers + a 0ms
  flush — report the timing symptom; fall back to `vi.useFakeTimers()` +
  `vi.advanceTimersByTimeAsync(0)` as the `flush`.
- `submitHunterPick` returns false during a resolution that should be waiting
  (routing mismatch between `EventsActions.submitHunterPick` and the two
  resolutions) — report the branch.

## Deviations from plan — what actually shipped

These came out of running the harness against the real code and were safer
than the spec assumed:

- **Hunter forcing**: the spec used `DEV_FORCE_HUNTER`. That env var can
  splice CUPID out of the role list (HUNTER isn't in `initRolesList`, so the
  fallback removes index 0 — sometimes CUPID) → `cupidAction` throws. The
  simulator instead converts a VILLAGER to HUNTER after `assignRoles()` via
  `setRole('HUNTER') + setSpecialRolePlayer` (no re-teaming —
  `addTeamVillager` doesn't dedup), so CUPID/WITCH/werewolves stay intact.
- **Determinism**: `Game.shuffleArray` uses `Math.random`, so a seeded `rng`
  alone left role assignment non-deterministic and failing seeds drifted run
  to run. The simulator now also saves/restores and seeds `Math.random` in
  `setup()`/`dispose()`, making every game fully reproducible from its seed.
- **Dawn capture**: `playSegment(DAY)` fires `nightDawnResolution.run()`
  fire-and-forget, so the simulator can't await/re-feed it. The simulator
  wraps `nightDawnResolution.run` at construction to capture the promise
  (instead of re-calling `run()`, which would double deaths + audio).
- **No day-vote heuristic**: the spec's "self-correcting village" heuristic
  became unnecessary once `checkIfWinner` declares a werewolf win at 0
  villagers. The day vote is now fully random (unanimous, so no ties), which
  is more authentic coverage.
- **No `simWinner` patch**: shipped without it; production `checkIfWinner`
  handles termination.
- **Placeholder audio**: `getSegmentEndAudio('WITCH-HEAL')` returns
  `'not implemented yet'` and plays every night, so `assertNoPlaceholderAudio`
  was replaced by `assertOnlyKnownPlaceholders` — it asserts the *only*
  placeholder is that known gap and fails if a new one (e.g. a future HUNTER
  segment) leaks.

## Maintenance notes

- New death-audio paths added to `audio-manager.ts` / `special-scenarios.ts` /
  the resolutions must extend `LOVER_CUES` / `HUNTER_CUES` in
  `audio-validators.ts` in the same commit, or the random-games invariants
  will go stale.
- When the HUNTER segment is implemented (`getSegmentStartAudio('HUNTER')`
  returns `'not implemented yet'`), add a real start audio and a
  `HUNTER`-segment simulation branch; `assertNoPlaceholderAudio` will flag the
  placeholder until then.
- The dead-witch-segments-still-run quirk (witch wake-up audio after the witch
  dies) is a separate fix; until then the simulator records it authentically.
- Plan 027 (day-vote revote on tie) will need a simulator branch for the tie
  path; today the simulator votes unanimously to avoid ties.
