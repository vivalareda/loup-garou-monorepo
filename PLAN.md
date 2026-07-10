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

## Step 2 — Effect segment runner (driven by the post-day-vote feature)

Port the segment *orchestration* layer to Effect. Do not wrap the remaining old code in
`Effect.sync` for completeness — `Game`'s pure logic (tallies, win checks) stays plain.

- [ ] Model a segment run as an Effect program with `Deferred`-based waits:
      emit `hunter:pick-required`, then `Deferred.await(hunterPick)`; the socket
      handler completes the Deferred. Same pattern for the lover-grief chain.
- [ ] Delete the `hunterKilledDuringDayVote` flag in `events-actions.ts` — day-vote vs
      night context becomes lexical (the code around the await), not mutable state.
- [ ] Implement the four unchecked scenarios from `notes.md` as linear sequences:
  - [ ] Village killed hunter
  - [ ] Village killed lover
  - [ ] Village killed lover which is the hunter
  - [ ] Village killed lover but second lover is hunter

## Step 3 — Typed errors where they pay off first

- [ ] `getDayVoteTarget` currently `throw`s on a tie ("will be implemented later") —
      a real game would crash. Return `Effect<Player, DayVoteTie>` and handle the tie
      explicitly (decision: revote between tied players, or nobody dies).

## Step 4 — Cash in the DI motivation

- [ ] Provide a test layer with a silent `AudioManager` so scenario tests don't play
      real audio (this is probably what's timing out `segments.test.ts`)
- [ ] One test per post-day-vote scenario, in the style of `single-hunter-test`

## Later / parked

- Game restart in the Effect entry point (`index.effect.ts` logs "not yet implemented")
- Intro audio TODO in `segments-manager.ts:106`
- Switch `dev` script to the Effect entry point once it reaches parity
