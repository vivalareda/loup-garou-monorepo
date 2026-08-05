# Plan — resuming work (July 2026)

Context: the server is mid-migration to Effect-TS (started Dec 2025). The migration
exists for three reasons: **pausing segment execution** while waiting on player input
(hunter revenge pick, lover death chain), **DI via layers** for testing, and **typed
errors**. The current `.effect.ts` files are DI wrappers only — the pause/resume payoff
(`Deferred`) is not implemented yet. The next gameplay feature (post-day-vote death
scenarios, see `notes.md`) is the vehicle to finish that part of the migration.

## Step 1 — Stabilize the repo

- [x] Delete `apps/server/effect/` (32 MB reference clone of the Effect repo; vitest
      picks it up and reports ~650 bogus test-file failures)
- [x] Fix `apps/server/tsconfig.json`: `declarationMap` without `declaration` broke
      `tsc --noEmit`; NodeNext module resolution broke every extensionless import —
      switched to `module: ESNext` + `moduleResolution: Bundler` (server runs via tsx)
- [x] Upgrade toolchain (requested):
  - TypeScript `~5.8.3` → `^7.0.2` (native compiler)
  - `@effect/language-service` → `@effect/tsgo` (the TS7-compatible Effect LSP;
    `prepare` script is now `effect-tsgo patch`)
  - `effect` `^3.19` → `^3.21.4` (latest stable; v4 is still beta-only),
    `@effect/platform` `^0.96`, `@effect/platform-node` `^0.107`
- [x] Create an `effect-migration` branch and commit the WIP there, keeping `main` clean
- [x] Fix the real failing tests (all 45 now pass, suite runs in <1 s):
  - tests were constructing `EventsActions`/`GameActions` with stale signatures
  - `segments.test.ts` played real audio through `sound-play` (the 10 s timeouts) —
    now mocked at the module level
  - restored `currentSegment = 0` (a "start at werewolf" testing leftover made the
    game skip the cupid/lovers night in production too)
  - fixed `playWinnerAudio('villagers')` playing the werewolves' victory audio
- [x] Gate the testing hack in `Game.assignRoles`: forced-hunter is now opt-in via
      `DEV_FORCE_HUNTER=<player name>`, and no longer returns early (which left every
      other player without a role)

## Step 1b — Expo upgrade (requested)

- [x] `apps/mobile`: Expo SDK 54 → 57 via `expo install --fix` (react-native 0.86,
      react 19.2.3, typescript ~6.0.3 as required by the SDK). Two API breakages
      fixed: `expo-navigation-bar` lost `setButtonStyleAsync`/`setBackgroundColorAsync`
      (edge-to-edge only now → `setStyle`), and `NodeJS.Timeout` →
      `ReturnType<typeof setTimeout>` in `use-card-flip`.

## Step 1c — Audio debugging flag (requested)

- [x] `DEBUG_AUDIO=1` makes `AudioManager.playAudio` log
      `[AUDIO] Would play: <file>` (flagging missing assets) instead of playing the
      mp3 — for checking segment/audio ordering without sitting through recordings
- [x] Server no longer crashes without a TTY (`setRawMode` guard in `index.ts`)

## Step 2 — Effect day-vote resolution (the Deferred payoff) — DONE

Implemented as `src/server/day-vote-resolution.ts`: one linear Effect program that
resolves a day-vote elimination — the kill, lover grief deaths, dead hunters' revenge
shots, recursively (a revenge target can itself be a lover). `Game`'s pure logic
(tallies, win checks) stays plain classes.

- [x] `Deferred`-based wait: the program emits `hunter:pick-required` and parks on
      `Deferred.await`; the `hunter:killed-player` socket handler completes it via
      `submitHunterPick` (returns false when the pick belongs to the night flow)
- [x] Deleted the `hunterKilledDuringDayVote` flag — day-vote vs night context is
      now the program's position, not mutable state
- [x] The four scenarios from `notes.md`, each with a test:
  - [x] Village killed hunter
  - [x] Village killed lover
  - [x] Village killed lover which is the hunter
  - [x] Village killed lover but second lover is hunter
- [x] Day-vote mock scenarios (`admin:mock-day-vote-*`) now drive the real
      resolution path instead of smuggling DAY_VOTE causes through the night queue
- [x] Verified end-to-end over a real socket with `DEBUG_AUDIO=1`: vote-death →
      lover grief → pause on hunter pick → resume → next segment

## Step 3 — Day-vote tie — DONE (nobody-dies rule)

- [x] `getDayVoteResult()` replaces the throwing `getDayVoteTarget()`; a tie returns
      `{ kind: 'tie', tiedPlayerNames }`. Rule for now: **nobody dies** — clients get
      a new `day:vote-tie` event (added to `@repo/types`) and the game moves to night.
      A revote flow can replace this later (needs mobile UI).

## Step 4 — Tests — DONE

- [x] `sound-play` is module-mocked in tests, so all AudioManager logic stays real
      and audio *order* is asserted without playing mp3s
- [x] `day-vote-scenarios.test.ts`: one test per scenario + grief-cascade on the
      revenge target + tie + night-flow fallback (52 tests total, all green)

## Later / parked

- Full port of the segment runner (`SegmentsManager`) to Effect — the day-vote chain
  proves the pattern; night flow (`handleHunterPlayerPick` etc.) still uses the queue
- Revote-on-tie instead of nobody-dies (needs mobile UI for `day:vote-tie`)
- Mobile UI for the `day:vote-tie` event
- Game restart in the Effect entry point (`index.effect.ts` logs "not yet implemented")
- Intro audio TODO in `segments-manager.ts`
- Switch `dev` script to the Effect entry point once it reaches parity
