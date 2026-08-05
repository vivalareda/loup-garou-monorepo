# Plan 001: Port the night/dawn death flow to the Deferred-based resolution pattern

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (rewrites the dawn control flow; behavior is pinned by existing tests, which this plan also updates)
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `4076a78` (branch `effect-migration`), 2026-07-10

## Why this matters

This repo is a real-time werewolf (loup-garou) game server. When night ends
("dawn"), queued night deaths are revealed: werewolf victims die, a dead
lover's partner dies of grief, and a dead hunter takes a revenge shot — which
requires **pausing the flow** until the hunter's player picks a target over
the socket. Today that pause is implemented by splitting the flow across
three classes (`SegmentsManager.runHunterSegment` → socket event →
`EventsActions.handleHunterPlayerPick` → `SegmentsManager.continueDayAction`),
which is hard to follow and to extend.

The repo already solved this exact problem for **day-vote** deaths:
`apps/server/src/server/day-vote-resolution.ts` runs the whole chain as one
linear Effect program that parks on an Effect `Deferred` until the pick
arrives. This plan ports the night/dawn flow to the same pattern, deleting
the split-flow code and the dead `hunterDiedFirst` flag. After this lands,
both death flows read top-to-bottom and the "waiting for hunter" state is
the program's position instead of mutable flags.

**Critical constraint: this is a control-flow port, not a redesign.** Night
deaths must keep going through the `DeathManager` pending-death queue and
`Game.processPendingDeaths()` exactly as they do today (unlike the day-vote
flow, which kills immediately). The audio call order per branch must be
preserved exactly — the mp3s are recorded narration and their order is the
game's UX.

## Current state

All paths relative to repo root. The server package is `apps/server`.

### Files and their roles

- `apps/server/src/server/day-vote-resolution.ts` — **the exemplar**. The
  pattern you are replicating. Read it in full before starting.
- `apps/server/src/segments/segments-manager.ts` — owns the segment loop.
  `playSegment()` has the DAY-segment branching to be replaced;
  `runHunterSegment()` (line ~150), `runLoverSegment()` (~192),
  `checkPostDayVoteScenarios()` (~200, **dead code — zero callers**), and
  `continueDayAction()` (~251) all get deleted.
- `apps/server/src/server/events-actions.ts` — socket-event glue.
  `handleHunterPlayerPick()` (the night pick handler) gets deleted; its body
  moves into the new resolution. `submitHunterPick()` gets extended to route
  to the night resolution as fallback.
- `apps/server/src/server/server-events.ts` — socket handler registration.
  The `hunter:killed-player` handler (~line 184) gets simplified.
- `apps/server/src/core/special-scenarios.ts` — audio sequences for special
  dawn scenarios. The `hunterDiedFirst` property is **written twice and read
  nowhere** — delete it. Keep the two audio methods.
- `apps/server/src/core/game.ts` — pure-ish game logic. **Do not change any
  death semantics here.** You will only *call* existing methods.
- `apps/server/src/core/game-actions.ts` — `dayAction()` (line ~119) is the
  "finish the dawn" step: processes the queue, checks winner, starts the
  day vote. Unchanged; the new resolution calls it.
- `apps/server/src/segments/mock-scenario.ts` — dashboard-triggered test
  scenarios; three night mocks call `handleHunterPlayerPick` in a
  `setTimeout` and must switch to `submitHunterPick`.
- Tests: `apps/server/src/__tests__/hunter-scenarios.test.ts` and
  `apps/server/src/__tests__/single-hunter-test.test.ts` pin the current
  night-flow behavior and get rewritten (full replacements below).
  `apps/server/src/__tests__/day-vote-scenarios.test.ts` is the structural
  pattern for the new test style — read it.

### The exemplar pattern (day-vote-resolution.ts, current and unchanged)

The whole file is ~120 lines; the load-bearing parts:

```ts
// apps/server/src/server/day-vote-resolution.ts
export class DayVoteResolution {
  private pendingHunterPick: Deferred.Deferred<string> | null = null;

  submitHunterPick(targetSid: string) {
    const pick = this.pendingHunterPick;
    if (!pick) {
      return false;
    }
    this.pendingHunterPick = null;
    Deferred.unsafeDone(pick, Effect.succeed(targetSid));
    return true;
  }

  private awaitHunterPick() {
    return Effect.gen(this, function* () {
      const pick = yield* Deferred.make<string>();
      this.pendingHunterPick = pick;
      this.io.emit('hunter:pick-required');
      return yield* Deferred.await(pick);
    });
  }
  // resolveElimination / resolveConsequences: Effect.gen(this, function* () { ... })
  // programs that yield* audio Effects and the awaitHunterPick pause.
}
```

Note the idioms: `Effect.gen(this, function* () { ... })` for `this`-bound
generators, `Effect.promise(() => ...)` to lift async audio calls, and
`Effect.runPromise` at the entry point.

### The current dawn branching to replace (segments-manager.ts:223-249)

```ts
async playSegment() {
  const segment = this.segments[this.currentSegment];
  console.log(`[SEGMENT] Playing segment: ${segment.type}`);

  if (segment.type === 'DAY') {
    console.log('isHunterInDeathQueue', this.isHunterInDeathQueue());
    if (this.isHunterInDeathQueue()) {
      this.runHunterSegment();
      return;
    }

    if (this.isOneOfLoversInDeathQueue()) {
      if (this.game.isPartnerHunter()) {
        // Direct property access - no need to find()
        this.specialScenarios.partnerIsHunter();
        this.game.updateHunterPlayerList();
        this.hunterSegment.action();
        return;
      }
      this.runLoverSegment();
      return;
    }
  }

  await this.audioManager.playSegmentAudio(segment.type, true);
  segment.action();
}
```

`this.hunterSegment.action()` is `() => this.gameActions.hunterAction()`
which is just `this.io.emit('hunter:pick-required')` (game-actions.ts:133).

### The methods whose bodies move into the new resolution

`segments-manager.ts:150-177`:

```ts
async runHunterSegment() {
  console.log('running hunter segment');
  const hunter = this.game.getSpecialRolePlayer('HUNTER');
  if (!hunter) {
    throw new Error(
      'tried to play hunter segment but hunter player not found'
    );
  }
  const isLover = this.game.isPlayerLover(hunter);

  if (isLover) {
    const partner = this.game.getPartner(hunter);
    if (!partner) {
      throw new Error('lover could not be found');
    }
    this.game.addPartnerSuicide(hunter.getSocketId(), partner.getSocketId());
    await this.specialScenarios.hunterIsLover();
  } else {
    await this.audioManager.playHunterAudio();
  }

  // Mark that hunter died first so the correct audio plays after hunter's revenge
  this.specialScenarios.hunterDiedFirst = true;

  // Direct property access - no need to find()
  this.game.updateHunterPlayerList();
  this.hunterSegment.action();
}
```

`segments-manager.ts:192-198`:

```ts
async runLoverSegment() {
  const segment = this.segments[this.currentSegment];
  await this.audioManager.playLoverAudio();
  if (!this.isGameOver()) {
    segment.action();
  }
}
```

(`segment.action()` at the DAY index is `() => this.gameActions.dayAction()`.)

`segments-manager.ts:251-259`:

```ts
continueDayAction() {
  if (this.isGameOver()) {
    return;
  }

  this.audioManager.playDayVoteAudio();
  const segment = this.segments[this.currentSegment];
  segment.action();
}
```

`events-actions.ts:28-63` (the night pick handler — its steps become the
post-pick part of the hunter branch):

```ts
/** Night flow: hunter died during the night, revealed at dawn. */
async handleHunterPlayerPick(targetSid: string) {
  // Step 1: Kill the hunter's revenge target
  this.game.killHunterRevenge(targetSid);

  // Step 2: Check if the victim is a lover → trigger partner suicide
  if (this.game.isHunterVictimInLove(targetSid)) {
    console.log(`🎯💕 [HUNTER] Hunter killed a lover: ${targetSid}`);

    const lover = this.game.getPlayerBySocketId(targetSid);
    if (!lover) {
      throw new Error(`Target ${targetSid} not found`);
    }

    const partner = this.game.getPartner(lover);
    if (!partner) {
      throw new Error(`Partner not found for ${targetSid}`);
    }

    console.log(
      `🎯💕 [HUNTER] Partner ${partner.getSocketId()} will also die`
    );

    // Add partner to death queue
    this.game.addPendingDeath(partner.getSocketId(), 'PARTNER_SUICIDE');

    // Play special audio for hunter killing lover
    await this.segmentsManager.audioManager.playHunterKilledLover();
  }

  // Step 3: Check if the HUNTER had a lover → trigger partner suicide
  this.game.isHunterInLove();

  // Step 4: Continue to the day action
  this.segmentsManager.continueDayAction();
}
```

### Semantics you must preserve (do not "fix" these)

- Night deaths are **queued**, not immediate. `Game.processPendingDeaths()`
  (game.ts:421-479) runs inside `dayAction()` and does the two-pass cascade
  (pass 1 queues partner suicides for queued lovers; pass 2 kills everyone
  and drains the queue). The new resolution must NOT kill queued players
  itself — it only queues, plays audio, pauses for the pick, and then calls
  `dayAction()`.
- `game.killHunterRevenge(targetSid)` (game.ts:520) both records a
  HUNTER_REVENGE queue entry AND kills the target immediately. That is
  existing, tested behavior (`single-hunter-test.test.ts`). Leave it.
- `game.isHunterInLove()` (game.ts:390) is a *side-effecting check* that
  queues the hunter's lover as PARTNER_SUICIDE. Call it exactly where the
  old code did (after the victim-lover check).
- In the "lover died, surviving partner is the hunter" branch, the hunter's
  own grief death is NOT queued explicitly — `processPendingDeaths` pass 1
  cascades it. Do not add an explicit queue call.
- Audio call order per branch (see "Target design") is exact.

### Repo conventions

- Effect v3 (`effect@^3.21`), TypeScript 7 (`tsc` is the native compiler).
- Path alias `@/*` → `apps/server/src/*`.
- Tests are vitest, colocated under `src/__tests__/`. Audio is silenced by
  mocking the `sound-play` module (see the top of
  `day-vote-scenarios.test.ts`) — never by sleeping or raising timeouts.
- `DEBUG_AUDIO=1` env var makes `AudioManager.playAudio` log
  `[AUDIO] Would play: <file>` instead of playing the mp3.

## Commands you will need

All run from `apps/server/` unless noted.

| Purpose | Command | Expected on success |
|---|---|---|
| Install (repo root) | `pnpm install` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0, no `error` lines (a `suggestion TS377025` line about socket-io.effect.ts is pre-existing and OK) |
| Tests | `pnpm test:run` | exit 0, all tests pass (52 before this plan; more after) |
| One test file | `pnpm test:run night-dawn` | matching file passes |
| Boot server (manual check) | `DEBUG_AUDIO=1 pnpm exec tsx src/index.ts` | logs `Werewolf Game Server running on port 3000` |

## Scope

**In scope** (the only files you should modify or create):

- `apps/server/src/server/night-dawn-resolution.ts` (create)
- `apps/server/src/segments/segments-manager.ts`
- `apps/server/src/server/events-actions.ts`
- `apps/server/src/server/server-events.ts`
- `apps/server/src/core/special-scenarios.ts`
- `apps/server/src/segments/mock-scenario.ts`
- `apps/server/src/__tests__/hunter-scenarios.test.ts` (rewrite)
- `apps/server/src/__tests__/single-hunter-test.test.ts` (rewrite)
- `apps/server/src/__tests__/night-dawn-scenarios.test.ts` (create)
- `plans/README.md` (status row only)

**Out of scope** (do NOT touch, even though they look related):

- `apps/server/src/server/day-vote-resolution.ts` — the working exemplar.
  If you feel you need to change it, STOP.
- `apps/server/src/core/game.ts`, `game-actions.ts`, `death-manager.ts`,
  `audio-manager.ts` — death/audio semantics are frozen for this plan.
- `apps/server/src/*.effect.ts` and `src/server/*.effect.ts` — unused
  scaffolding from an earlier migration attempt; ignore entirely.
- `apps/mobile/`, `apps/dashboard/`, `packages/types/` — no client or
  shared-type changes are needed (no new socket events in this plan).
- `apps/server/src/__tests__/day-vote-scenarios.test.ts` and
  `src/__tests__/segments.test.ts` — must keep passing WITHOUT edits; if
  one fails, your change broke shared behavior (STOP condition).

## Git workflow

- Work on the existing `effect-migration` branch.
- One commit per step or logical unit. Message style: short imperative
  subject + body bullets (see `git log --oneline -5`; e.g. "Implement
  post-day-vote death scenarios with Deferred-based pause/resume").
- Do NOT push.

## Target design

Create `apps/server/src/server/night-dawn-resolution.ts` exporting class
`NightDawnResolution`, constructed with `(game: Game, segmentsManager:
SegmentsManager, io: SocketType)` — same shape as `DayVoteResolution`.
Access the audio manager as `this.segmentsManager.audioManager` and game
actions as `this.segmentsManager.getGameActions()`. Import types only for
`SegmentsManager` (`import type`) to avoid a runtime import cycle;
`SegmentsManager` will hold the instance (like it already holds
`gameActions`).

Public API:

- `run(): Promise<void>` — `Effect.runPromise(this.resolveDawn())`.
- `submitHunterPick(targetSid: string): boolean` — identical mechanism to
  the exemplar (`Deferred.unsafeDone`, return `false` when nothing pending).

`resolveDawn()` is one `Effect.gen(this, function* () { ... })` with four
branches, preserving these exact call sequences:

**Branch A — hunter is in the death queue** (`game.hunterIsInDeathQueue()`):

1. `const hunter = game.getSpecialRolePlayer('HUNTER')` — if missing, this
   is a defect; `throw` inside the generator like the old code did.
2. If `game.isPlayerLover(hunter)`:
   `game.addPartnerSuicide(hunter.getSocketId(), partner.getSocketId())`
   (partner from `game.getPartner(hunter)`, throw if missing), then
   `yield* Effect.promise(() => specialScenarios.hunterIsLover())`.
   Else: `yield* Effect.promise(() => audioManager.playHunterAudio())`.
3. `game.updateHunterPlayerList()`.
4. `const targetSid = yield* this.awaitHunterPick()` — emits
   `hunter:pick-required` and pauses (exemplar pattern verbatim).
5. Post-pick consequences, in this order (from the old
   `handleHunterPlayerPick`):
   a. `game.killHunterRevenge(targetSid)`
   b. If `game.isHunterVictimInLove(targetSid)`: resolve the victim and
      partner (throw if missing, as the old code did), then
      `game.addPendingDeath(partner.getSocketId(), 'PARTNER_SUICIDE')`,
      then `yield* Effect.promise(() => audioManager.playHunterKilledLover())`.
   c. `game.isHunterInLove()`
6. If `segmentsManager.isGameOver()` → return (this mirrors the old
   `continueDayAction` guard; note it runs BEFORE the queue is processed —
   preserve that).
7. `yield* Effect.promise(() => audioManager.playDayVoteAudio())`
8. `yield* Effect.promise(() => segmentsManager.getGameActions().dayAction())`

**Branch B — a lover is in the death queue AND `game.isPartnerHunter()`**:

1. `yield* Effect.promise(() => specialScenarios.partnerIsHunter())`
2. `game.updateHunterPlayerList()`
3. Steps 4–8 of Branch A verbatim (pause, consequences, guard, day-vote
   audio, dayAction). Factor A4–A8 into a private
   `hunterPickAndContinue()` Effect used by both branches.

**Branch C — a lover is in the death queue, partner is NOT the hunter**:

1. `yield* Effect.promise(() => audioManager.playLoverAudio())`
2. If `!segmentsManager.isGameOver()`:
   `yield* Effect.promise(() => segmentsManager.getGameActions().dayAction())`

**Branch D — no special deaths**:

1. `yield* Effect.promise(() => audioManager.playSegmentAudio('DAY', true))`
2. `yield* Effect.promise(() => segmentsManager.getGameActions().dayAction())`

Branch order matters: A, then B/C, then D — same as today's `playSegment`.

## Steps

### Step 1: Create `NightDawnResolution`

Create `apps/server/src/server/night-dawn-resolution.ts` per "Target
design". Model every mechanism on `day-vote-resolution.ts` — same imports,
same `Deferred` usage, same doc-comment style explaining the pause.

**Verify**: `pnpm typecheck` → exit 0 (file compiles; nothing uses it yet).

### Step 2: Wire it into `SegmentsManager` and replace the DAY branch

In `segments-manager.ts`:

1. Add a public readonly `nightDawnResolution: NightDawnResolution` field,
   constructed in the constructor after `gameActions`:
   `this.nightDawnResolution = new NightDawnResolution(game, this, io);`
2. Replace the entire `if (segment.type === 'DAY') { ... }` block AND the
   trailing default lines of `playSegment()` so it reads:

```ts
async playSegment() {
  const segment = this.segments[this.currentSegment];
  console.log(`[SEGMENT] Playing segment: ${segment.type}`);

  if (segment.type === 'DAY') {
    // Dawn (night-death reveal + day start) runs as one resolution
    // program; it pauses internally when the hunter must pick
    this.nightDawnResolution.run().catch((error) => {
      console.error('night dawn resolution failed:', error);
    });
    return;
  }

  await this.audioManager.playSegmentAudio(segment.type, true);
  segment.action();
}
```

Note Branch D (the plain `playSegmentAudio('DAY', true)` + `dayAction()`)
now lives inside the resolution, so the DAY case returns unconditionally.

3. Delete `runHunterSegment()`, `runLoverSegment()`,
   `checkPostDayVoteScenarios()` (already dead code), and
   `continueDayAction()`.

**Verify**: `pnpm typecheck` → exit 0.
**Verify**: `grep -n "runHunterSegment\|continueDayAction\|checkPostDayVoteScenarios\|runLoverSegment" src -r` → only matches (if any) are in the two test files you haven't rewritten yet.

### Step 3: Update the socket routing and delete the old handler

In `events-actions.ts`:

1. Delete `handleHunterPlayerPick` entirely.
2. Extend `submitHunterPick` to fall through to the night resolution:

```ts
submitHunterPick(targetSid: string) {
  return (
    this.dayVoteResolution.submitHunterPick(targetSid) ||
    this.segmentsManager.nightDawnResolution.submitHunterPick(targetSid)
  );
}
```

In `server-events.ts`, replace the `hunter:killed-player` handler body with:

```ts
socket.on('hunter:killed-player', (targetSid: string) => {
  if (!this.eventsActions.submitHunterPick(targetSid)) {
    console.warn(
      `hunter pick for ${targetSid} received but no resolution is waiting`
    );
  }
});
```

In `special-scenarios.ts`, delete the `hunterDiedFirst` property and the
`this.hunterDiedFirst = true;` line inside `partnerIsHunter()` (the flag is
never read).

**Verify**: `pnpm typecheck` → exit 0.
**Verify**: `grep -rn "hunterDiedFirst\|handleHunterPlayerPick" src/` → matches only in `mock-scenario.ts` and old test files (next steps).

### Step 4: Update the mock scenarios

In `mock-scenario.ts`, three night mocks submit the hunter pick after a
delay. Replace each `this.eventsActions.handleHunterPlayerPick('<sid>')`
call (in `runWerewolfKillLoverSecondIsHunter`,
`runWerewolfKillLoverWhoIsHunter`, `runHunterRevengeKillsLover`) with
`this.eventsActions.submitHunterPick('<same sid>')` — keep the surrounding
`setTimeout` and logging as is.

**Verify**: `pnpm typecheck` → exit 0.
**Verify**: `grep -n "handleHunterPlayerPick" src/segments/mock-scenario.ts` → no matches.

### Step 5: Rewrite the two legacy night tests

The old tests called `handleHunterPlayerPick` directly or asserted
intermediate queue states mid-flow. The new tests drive the public surface:
jump to the DAY segment, `playSegment()`, wait a tick, submit the pick,
assert final state. Replace **the full contents** of both files:

`apps/server/src/__tests__/single-hunter-test.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

// Never play real audio in tests — sound.play blocks until the mp3 finishes
vi.mock('sound-play', () => ({
  default: { play: vi.fn().mockResolvedValue(undefined) },
}));

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('Night dawn: hunter who is a lover dies during the night', () => {
  let game: Game;
  let segmentsManager: SegmentsManager;
  let eventsActions: EventsActions;
  let mockIo: SocketType;
  let emitSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    emitSpy = vi.fn();
    mockIo = {
      to: vi.fn().mockReturnThis(),
      emit: emitSpy,
    } as unknown as SocketType;

    const deathManager = new DeathManager();
    game = new Game(mockIo, deathManager);
    const audioManager = new AudioManager(deathManager);
    segmentsManager = new SegmentsManager(
      game,
      mockIo,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );
    eventsActions = new EventsActions(game, segmentsManager, mockIo);
  });

  it('kills the partner, pauses for the pick, then kills the revenge target', async () => {
    const hunter = game.addPlayer('Hunter', 'mock-id-1');
    const partner = game.addPlayer('Partner', 'mock-id-2');
    const villager = game.addPlayer('Villager', 'mock-id-3');
    const werewolf = game.addPlayer('Werewolf', 'mock-id-4');

    hunter.setRole('HUNTER');
    game.setSpecialRolePlayer(hunter);
    partner.setRole('VILLAGER');
    villager.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    for (const p of [hunter, partner, villager, werewolf]) {
      game.setPlayerTeams(p);
    }

    game.setLovers(['mock-id-1', 'mock-id-2']);
    game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    segmentsManager.currentSegment = daySegmentIndex;
    segmentsManager.playSegment();
    await tick();

    // Flow is parked waiting for the hunter's revenge pick
    expect(emitSpy.mock.calls.map((c) => c[0])).toContain(
      'hunter:pick-required'
    );
    // Queued deaths are not processed until the dawn completes
    expect(hunter.isAlive).toBe(true);

    eventsActions.submitHunterPick('mock-id-3');
    await tick();

    // Revenge target killed immediately; queued deaths processed by dayAction
    expect(villager.isAlive).toBe(false);
    expect(hunter.isAlive).toBe(false);
    expect(partner.isAlive).toBe(false);
    expect(werewolf.isAlive).toBe(true);
    expect(game.getDeathQueue()).toHaveLength(0);
  });
});
```

`apps/server/src/__tests__/hunter-scenarios.test.ts`: keep its existing
first test ("it should kill partner if lover dies") logic but drop the
`vi.spyOn(segmentsManager, 'isHunterInDeathQueue')` line (no hunter exists
in that setup, so the branch is naturally skipped), keep the `await
segmentsManager.playSegment()` + add `await tick()` before the assertions,
and add the same `vi.mock('sound-play', ...)` header and `tick` helper as
above. Replace its mock `AudioManager`/`SpecialScenarios` objects with real
instances (the sound-play mock silences them). For the third test ("should
emit hunter pick event if lover is a hunter"): same setup, then after
`playSegment()` + `await tick()`, assert
`emitSpy.mock.calls.map((c) => c[0])` contains `'hunter:pick-required'`,
then `eventsActions.submitHunterPick('mock-id-3')`, `await tick()`, and
assert the hunter partner (`mock-id-2`) and the original lover
(`mock-id-1`) are dead and `mock-id-3` is dead. Delete the second test
("it should kill hunters lover when hunter dies") — its scenario is covered
more completely by the rewritten single-hunter test above.

**Verify**: `pnpm test:run` → exit 0, all tests pass, including
`day-vote-scenarios.test.ts` and `segments.test.ts` UNCHANGED.

### Step 6: Add dawn-scenario tests

Create `apps/server/src/__tests__/night-dawn-scenarios.test.ts`, modeled
structurally on `day-vote-scenarios.test.ts` (same `sound-play` mock, same
`tick` helper, same `addPlayer` helper style), covering:

1. **Plain night death (Branch D + queue cascade)**: villager dies to
   werewolves, no lovers/hunter → after `playSegment()` + tick, villager is
   dead, queue empty. Assert `playAudio` was called with
   `'Night-end/Wake-up-everyone'` then `'Night-end/one-death'` then
   `'day-vote-start'` (spy on `audioManager.playAudio`).
2. **No deaths at all (Branch D)**: empty queue → `'Night-end/no-death'`
   appears in the played audio, nobody dies.
3. **Lover dies, partner not hunter (Branch C)**: both lovers end up dead,
   queue empty, and `playAudio` calls start with
   `'Night-end/Wake-up-everyone'`, `'Special-death/pre-day-vote-lover-2'`
   (that is `playLoverAudio`'s sequence).
4. **Hunter (not lover) dies (Branch A)**: flow pauses
   (`hunter:pick-required` emitted, hunter still alive), pick kills target
   immediately, then queue processing kills the hunter; audio starts with
   `playHunterAudio`'s sequence (`'Night-end/Wake-up-everyone'`,
   `'Night-end/Deaths'`, `'Hunter/Hunter'`).
5. **Lover dies, surviving partner is the hunter (Branch B)**: pause, pick,
   then both lovers dead (partner's grief death via the
   `processPendingDeaths` cascade) plus the revenge target dead.
6. **Pick with nothing pending**: `eventsActions.submitHunterPick('x')`
   returns `false` when no resolution is waiting (and no day-vote either).

Give each test enough players that the game does NOT end (keep ≥1 werewolf
and ≥2 villagers alive at the end), except where a game-over assertion is
the point — the day-vote test file shows how end-game audio shows up in the
`playAudio` list when the game ends; avoid that noise here.

**Verify**: `pnpm test:run` → exit 0, new file passes with 6 tests.

### Step 7 (optional but recommended): manual end-to-end check

From `apps/server`: `DEBUG_AUDIO=1 pnpm exec tsx src/index.ts`, then from a
second terminal trigger the dashboard mock over socket.io (the dashboard app
does this; or adapt the pattern used in
`day-vote-scenarios` — connect with `socket.io-client`, emit
`'admin:mock-lover-second-hunter-event'`, wait for `'hunter:pick-required'`,
emit `'hunter:killed-player'` with `'mock-id-3'`). Expected server log
order: `[AUDIO] Would play:` lines for the partner-is-hunter sequence, a
pause until the pick, then `day-vote-start-universal` and the day starting.
Kill the server afterwards (`lsof -ti :3000 | xargs kill`).

## Test plan

Covered by Steps 5–6. Summary: 2 rewritten legacy files (behavior-pinning),
1 new file with 6 dawn-scenario tests. Structural pattern:
`apps/server/src/__tests__/day-vote-scenarios.test.ts`. Final gate:
`pnpm test:run` all green.

## Done criteria

ALL must hold (from `apps/server/`):

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm test:run` exits 0; `night-dawn-scenarios.test.ts` exists with 6 passing tests
- [ ] `day-vote-scenarios.test.ts` and `segments.test.ts` pass **without modification** (`git diff --name-only` does not list them)
- [ ] `grep -rn "hunterDiedFirst\|handleHunterPlayerPick\|continueDayAction\|runHunterSegment\|runLoverSegment\|checkPostDayVoteScenarios" src/` → no matches
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The drift check shows in-scope files changed since commit `4076a78`, and
  the "Current state" excerpts no longer match the live code.
- `day-vote-scenarios.test.ts` or `segments.test.ts` fails at any step —
  you broke shared behavior; do not edit those files to make them pass.
- You find yourself wanting to change `game.ts` death semantics (e.g. "fix"
  `killHunterRevenge`'s immediate kill, or the `isHunterInLove` overwrite of
  an existing queue entry) — those are known quirks pinned by tests;
  changing them is a different plan.
- `Deferred.unsafeDone` or `Effect.gen(this, ...)` doesn't typecheck against
  the installed `effect` version — the exemplar uses both, so this would
  mean the environment differs from the one this plan was written in.
- A rewritten test scenario produces a **different survivor set** than the
  old flow did (not just different assertion style) — that means the port
  changed behavior; report the diff in outcomes instead of adjusting the
  expected values.

## Maintenance notes

- `Game.processPendingDeaths()` still returns `DeathInfo[]` that nobody
  consumes, and `GameActions.announceNightDeaths()` (which would emit
  `night:deaths-announced` to clients) has zero callers. Wiring the death
  announcement into Branch D/C/A after `dayAction()` is a natural follow-up
  — deliberately out of scope here to keep the port behavior-neutral.
- Both resolutions now hold their own `pendingHunterPick` Deferred. If a
  third pause point ever appears (e.g. witch decisions as pausable steps),
  extract a shared `PickGate` helper rather than a third copy.
- The `.effect.ts` scaffolding files are still unused; once someone ports
  the entry point, `NightDawnResolution` and `DayVoteResolution` are the
  pieces worth exposing as Effect services.
- Reviewer focus: audio order per branch (compare against the excerpts in
  "Current state"), and that no death goes through a *new* code path — every
  kill should still trace to `killHunterRevenge`, `handlePlayerDeath` (via
  `processPendingDeaths`), or the queue.
