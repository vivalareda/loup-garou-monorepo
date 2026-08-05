# Complete Game Implementation Tasks

This is the implementation backlog for turning the current project into a complete,
reliable mobile Werewolf game. Work in document order, not numeric order: task numbers
only reflect when a task was added, and the family-playtest section (tasks 22-28) comes
before the remaining P1 work. Do not start by finishing the Effect migration: the live
server is `apps/server/src/index.ts`, and the existing class-based socket path should be
made playable first.

## Definition of done

A game is complete when six mobile clients can join, receive roles, play every enabled
role and phase, survive temporary disconnects, reach a correct winner, see the result,
and start another game without restarting the server process. Invalid, stale, duplicate,
or out-of-phase client messages must not corrupt or advance the game. No required player
action may block a game indefinitely.

Every task must add or update tests for its behavior. After each task, run the narrowest
relevant tests. Before marking a milestone complete, run:

```bash
pnpm check-types
pnpm lint
pnpm --filter server test:run
pnpm build
```

Do not change the intentional nobody-dies tie rule until the dedicated rule task below.
Do not wire the dead `socket-event-router.effect.ts` or `event-handlers.effect.ts` into
production as part of unrelated work.

## P0: Restore a playable happy path

### 1. Fix the mobile Witch flow

- [x] Listen for `witch:pick-poison-player` in
      `apps/mobile/hooks/use-game-events.ts` and open `WITCH-POISON`.
- [x] Give the poison modal explicit poison and skip actions. Emit
      `witch:poisoned-player` with a valid living target SID or
      `witch:skipped-poison`.
- [x] Fix the heal callback in `apps/mobile/app/(game)/game-interface.tsx`.
      `GlobalModal` supplies the scalar string `"yes"` or `"no"`; do not treat it as
      `string[]`.
- [x] Only open Witch modals for the living player whose role is `WITCH`.
- [x] Display the victim's player name rather than their raw socket ID.
- [x] Reset modal selection whenever a modal closes or its action type changes so a
      prior action cannot submit a stale target.
- [x] Add tests proving heal, skip-heal, poison, and skip-poison each emit exactly one
      correct event and close the modal.

Acceptance criteria:

- Choosing “yes” consumes the healing potion and removes the werewolf death.
- Choosing “no” advances to poison without consuming the healing potion.
- Poisoning and skipping both advance to dawn.
- A mobile-only game never stalls at either Witch phase.

### 2. Restore the first-night Cupid and Lovers phases

- [x] Correct `apps/server/src/segments/segments-manager.ts`: Cupid and Lovers must run
      once on the first night, then be skipped on subsequent nights.
- [x] Validate `cupid:lovers-pick` server-side: current phase is Cupid, sender is the
      living Cupid, and the payload contains exactly two distinct, existing, living,
      eligible player SIDs.
- [x] Decide and test whether Cupid may select themself. Keep mobile and server behavior
      consistent with that decision.
- [x] Replace the global lovers-close counter with acknowledgements keyed by the two
      selected lover SIDs. Ignore unauthorized and duplicate acknowledgements.
- [x] Reset lover acknowledgement state when a new game starts.
- [x] Send each lover the other lover's display name, or change the shared event field
      to explicitly carry both SID and name. Do not label a SID as a name.
- [x] Add segment-transition tests proving the sequence is Cupid, Lovers, Werewolf,
      Witch Heal, Witch Poison, Day on night one, then Werewolf onward on later nights.

### 3. Fix Hunter mobile input and known server defects

- [x] Fix `apps/mobile/app/(game)/game-interface.tsx`: a one-selection modal supplies a
      scalar SID. Do not emit the first character with `selectedPlayerSid[0]`.
- [x] Emit `hunter:pick-required` only to the dead Hunter, not every connected client.
- [x] Also guard Hunter UI by role and pending-death state on mobile.
- [x] Validate that a Hunter pick is made only while a Hunter resolution is waiting and
      targets an existing, living, non-Hunter player.
- [x] Complete `plans/008-fix-killHunterRevenge-double-kill.md` so a revenge target is
      killed and notified once.
- [x] Complete `plans/009-hunter-deferred-timeout.md` so an absent Hunter cannot freeze
      the game. Define and test the timeout fallback.
- [x] Keep Hunter disabled in normal role assignment until all items above pass.

### 4. Validate every gameplay command by phase

- [x] Introduce an authoritative server lifecycle/phase state covering at least:
      `LOBBY`, `CUPID`, `LOVERS`, `WEREWOLF`, `WITCH_HEAL`, `WITCH_POISON`, `DAWN`,
      `DAY_DISCUSSION`, `DAY_VOTE`, `HUNTER_PICK`, and `FINISHED`.
- [x] Reject actions that do not belong to the current phase without advancing it.
- [x] For every action validate sender membership, living/dead status as appropriate,
      role, target existence, target life, target eligibility, payload shape, and whether
      that sender has already completed the action.
- [x] Apply this to Cupid, Lovers, Werewolf initial and updated votes, both Witch
      decisions, day votes, and Hunter revenge.
- [x] Initial werewolf votes must reject nonexistent, dead, and werewolf targets, matching
      update-vote validation.
- [x] Witch poison must reject nonexistent or dead targets without throwing during dawn.
- [x] Return a typed acknowledgement or error event to the submitting client instead of
      only logging or throwing inside a Socket.IO callback.
- [x] Add replay/stale-message tests proving old events cannot skip later phases.

## P0: Family-playtest blockers

Tasks 1-4 and 8 are complete. The following tasks are the shortest remaining path to a
game that can actually be played and replayed in one room on real phones. Complete them,
in order, before any remaining P1 work. All product decisions in this section have
already been made; implement them as written.

### 22. Keep dead and finished players wired to the game

The game-event listeners in `apps/mobile/hooks/use-game-events.ts` are only mounted by
`apps/mobile/app/(game)/game-interface.tsx`. When a player dies they are routed to
`death-screen` and stop receiving every later event, including winner/loser routing and
restart. Someone dies on the first night of almost every game, so this strands a real
player every session.

- [x] Mount `useGameEvents()` once in `apps/mobile/app/(game)/_layout.tsx` (or an
      equivalent component above the individual game routes) instead of inside
      `game-interface.tsx`.
- [x] Verify listener cleanup still runs and no handler is registered twice after the
      move (see `plans/010-mobile-listener-leaks.md` for the established pattern).
- [x] Add a test proving a player who dies on the first night still receives
      winner/loser routing when the game ends.

Acceptance criteria:

- A dead player's phone shows the death screen during play and still lands on the
  winner or loser screen when the game ends, without any reconnect.

### 23. Keep phone screens awake during a game

New requirement, not previously in this backlog. In a living-room game players put
their phone down between turns; the screen locks, the OS backgrounds the app, and the
socket disconnects. Reconnect support (task 6) is incomplete, so a locked phone
currently means a lost player.

- [x] Install `expo-keep-awake` in `apps/mobile` (run `npx expo install expo-keep-awake`
      inside `apps/mobile` so Expo pins a compatible version).
- [x] Call `useKeepAwake()` in `apps/mobile/app/(game)/_layout.tsx` so the waiting room,
      game interface, death screen, and both result screens keep the screen on.
- [x] This does not replace task 6; it only reduces how often reconnect is needed.

Acceptance criteria:

- With the app foregrounded on any game route, the phone never auto-locks.

### 24. Support a configurable player count

`apps/server/src/server/server-events.ts` hard-codes `MAX_PLAYERCOUNT = 6` and
auto-starts on the sixth join, so a group of five or eight cannot play at all.
`Game.initRolesList()` in `apps/server/src/core/game.ts` already scales roles for any
count of at least 4. Decision (resolves the open decision in task 5): the player count
is a server environment variable and auto-start is kept; no host UI in this task.

- [x] Replace `MAX_PLAYERCOUNT` with a `PLAYER_COUNT` env var (default 6, minimum 4;
      reject invalid values at server startup with a clear error). Auto-start when that
      many players have joined.
- [x] Document `PLAYER_COUNT` in `apps/server/.env.example`.
- [x] Send the required player count to clients (for example inside the lobby
      players-list payload) and show progress in the mobile waiting room
      ("3/8 joueurs").
- [x] Add role-distribution tests for 4, 5, 6, and 8 players proving the role list
      length always equals the player count and the werewolf count is `floor(n / 3)`.

### 25. Give each phase its own realistic deadline

`scheduleDeadline()` in `apps/server/src/segments/segments-manager.ts` applies one
`SEGMENT_TIMEOUT_MS` (default 60s) to every segment, including the day vote. A family
argues for ten minutes before voting; the current timeout would resolve the vote out
from under them. Decision: keep the timeout-and-fallback mechanism, make the durations
per-segment.

- [x] Replace the single value with per-segment defaults, each overridable by its own
      env var: Cupid 120s, Lovers 60s, Werewolf 120s, Witch heal 60s, Witch poison 60s,
      day vote 600s, Hunter 60s.
- [x] Keep the existing fallback behaviors and fake-time tests; add a test proving two
      different segments use their own distinct durations.

### 26. Restart the game from the phones

The only restart path is pressing `r` in the server TTY (`apps/server/src/index.ts`),
which rebuilds `Game`/`SegmentsManager`/`GameEvents` and calls `setupSocketHandlers()`
again — stacking a second `connection` handler and orphaning sockets bound to the old
instances. Clients have no path back to the lobby. This task absorbs the
return-to-lobby/restart items from tasks 5 and 10.

- [x] Add a single in-place reset function on the server that clears all per-game state
      (task 5's cleanup list) without constructing new handler objects or re-registering
      socket handlers.
- [x] Add a `game:restarted` (or equivalent) server-to-client event to the shared types
      and emit it to every connected socket, including dead players and players on
      result screens.
- [x] On mobile, on that event: reset all Zustand state (local player, `isAlive`, role
      assignment, lists, votes, modal data/selection, pending redirects, connection
      state) and navigate every game route back to the join/lobby screen.
- [x] Add a play-again control on the winner and loser screens that triggers the server
      reset. Any player may trigger it; a host concept is out of scope.
- [x] Rewire the keyboard `r` path to call the same reset function.
- [x] Add a server test for two consecutive full games over the same sockets using this
      reset path (extend the existing consecutive-games tests from task 5).

Acceptance criteria:

- After a finished game, tapping play-again on any phone returns every connected phone
  to the lobby, and a second complete game can be played without restarting the server
  process or reconnecting any socket.

### 27. Reveal roles and the winning side at game end

The winner and loser screens currently show only the local player's own name. The role
reveal is the payoff of the game. This implements the final-event-payload bullet of
task 14 early; the victory-rule decision matrix stays in task 14.

- [x] Extend the game-end server events to carry the winning faction and the full list
      of players with display name, role, and alive/dead status.
- [x] Render that list on both the winner and loser screens.
- [x] Never emit the reveal payload before the game is finished.

### 28. Add one happy-path live-socket test

Promoted from task 17, which otherwise stays in P2. This is the only way to know a full
game completes without driving six physical phones, and it verifies tasks 22-27.

- [x] Add a Socket.IO integration test that boots the live server path and drives six
      clients through: join, role assignment, Cupid/Lovers, werewolf vote, both Witch
      decisions, dawn deaths, day vote, later nights, a winner, the role reveal, a
      client-triggered restart, and the start of a second game.
- [x] Make role assignment injectable/deterministic for this test.
- [x] The adversarial coverage (stale events, reconnects, timeouts, duplicates) remains
      in task 17; do not block this test on it.

## P1: Make the game lifecycle reliable

### 5. Guard lobby, start, finish, and restart

- [x] Reject or explicitly spectate joins after the game starts. A seventh join must not
      reassign roles or call `startGame()` again.
- [x] Prevent duplicate join submissions from one socket and define a duplicate-name
      policy.
- [x] Replace the raw `>= 6` start behavior with one idempotent start transition.
- Decided and moved to task 24: configurable count via a `PLAYER_COUNT` env var with
  auto-start kept.
- [x] Clear all per-game state before role assignment: teams, special-role map, votes,
      pending deaths, lovers, potion state, segment index/skip flags, acknowledgements,
      timers, and winner state.
- [x] Persist `FINISHED` state and reject later gameplay actions.
- Moved to task 26: server events and mobile controls for return-to-lobby/play-again,
  restarting connected clients in place, and rewiring the keyboard `r` path.
- [x] Add tests for duplicate start, seventh player, join-after-start, action-after-win,
      reset, and two consecutive games using the same sockets.

### 6. Add stable identity, reconnect, and state resynchronization

- [x] Stop using the transient Socket.IO ID as durable player identity. (The
      session token is the durable identity; on rejoin the server remaps every
      SID-keyed structure — votes, pending deaths, lover acks — to the new
      socket. Branded-ID contract cleanup remains in task 16.)
- [x] Issue a non-secret random player/session token on join and persist it securely on
      mobile for the duration of the game.
- [x] Add a reconnect/rejoin event that associates a new socket with the existing player.
- [x] Do not immediately kill a player on a temporary transport disconnect. Add a grace
      period and a documented policy after it expires. (`DISCONNECT_GRACE_MS`,
      default 90s; while it runs the player is not required for phase completion;
      on expiry the previous disconnect-equals-death policy applies.)
- [x] Add a server game-state snapshot containing only information that player is allowed
      to see: lifecycle, phase, public roster/alive state, own role, own pending prompt,
      private team/lover information where applicable, votes where permitted, potion
      availability, and final result.
- [x] Resend the current required action after successful reconnection.
- [x] Add mobile reconnecting, recovered, and unable-to-recover UI.
- [x] Never leak another player's secret role or private action in snapshots.
- [x] Test reconnect during every input phase and reconnect after death/game finish.

### 7. Add deadlines and disconnect fallbacks

- [x] Add configurable server deadlines for Cupid, lover acknowledgement, werewolf vote,
      Witch heal/poison, day vote, and Hunter revenge.
- [x] Define deterministic fallback behavior for each timeout. Prefer safe skip/no-action
      defaults; document any random selection.
- [x] Re-evaluate phase completion whenever a relevant player disconnects, dies, or their
      grace period expires.
- [x] Ensure dead/disconnected players are removed from pending vote requirements.
- [ ] Expose remaining time and timeout outcomes to clients.
- [x] Use injectable/fake time in tests; do not make tests sleep for real deadlines.

### 8. Correct Witch segment availability

- [x] Do not prompt for a consumed healing or poison potion on later nights.
- [x] If the Witch is absent or dead, automatically advance both Witch phases.
- [x] Ensure manually started games without a Witch cannot stall.
- [x] Reset potion and segment availability for a new game.
- [x] Add tests for each potion used, skipped, unavailable, and Witch death case.

## P1: Complete the player-facing round

### 9. Add phase, waiting, dawn, and tie UX

- [x] Send client-safe phase transitions and render the current phase on mobile.
- [x] Show “waiting for other players” after a player submits an action.
- [x] Actually emit `night:deaths-announced` from the live dawn flow and complete
      `plans/025-wire-night-deaths-announced.md` for mobile.
- [x] Display victim names and public death causes where the rules permit.
- [x] Consume `day:vote-tie` on mobile and show the tied players and nobody-dies result.
- [ ] Add a day-discussion state with an explicit server-controlled duration or host
      advance policy before voting begins. (Task 25's long day-vote deadline is the
      playtest-level mitigation; this full discussion state is still wanted.)
- [ ] Do not expose raw socket IDs in any player-facing modal.
- [ ] Add accessibility labels and disabled/submitted states to action controls.

### 10. Make death and game results functional

- Moved to task 22: mount game-level socket listeners above individual game routes so
  dead players still receive winner/loser and restart events.
- [ ] Make the death screen a real spectator view with public phase, roster, announced
      deaths, and final result. It must not expose private living-player information.
- [ ] Show the winning faction, all players and revealed roles, survivors, deaths, and
      relevant causes on the final screen. (Faction and role reveal land in task 27;
      add deaths, survivors, and causes here.)
- [ ] Add a leave control. (Return-to-lobby and play-again controls land in task 26.)
- Moved to task 26: reset all Zustand state on leave/new game.
- Moved to task 22: test that a player dying on the first night still reaches the final
  result screen.

### 11. Finish lobby and connection UX

- [ ] Trim and reject empty player names on both client and server.
- [ ] Prevent repeated Join taps and replace the accumulating `socket.on` join response
      listener with an acknowledged/one-shot flow.
- [ ] Request and display the full existing lobby list immediately after joining.
- [ ] Produce and consume `lobby:player-left`, or remove it from shared types if the new
      lifecycle makes another event authoritative.
- [ ] Display connection, join rejection, server-full, game-in-progress, and action-error
      states instead of console-only messages.
- [ ] Replace module-load crashes for missing backend URLs with a clear startup/config
      error screen in development builds.

## P2: Complete roles and rules

### 12. Enable Hunter in normal games

- [ ] After tasks 3, 4, 6, and 7 pass, add Hunter back to normal role generation.
- [ ] Define role counts for each supported player count and ensure the number of roles
      always equals the number of players.
- [ ] Exercise Hunter death by werewolves, Witch poison, day vote, and lover cascade in
      end-to-end tests.

### 13. Implement Seer end to end, or remove it from supported scope

Choose one option explicitly:

- [ ] Implement Seer: add a first-class segment, private pick-required event, validated
      client command, private role-result event, mobile selection/result UI, timeout,
      reconnect snapshot support, audio, and server/mobile tests.
- [ ] Or remove Seer from advertised supported roles, descriptions, and unreachable UI
      until a later release. Keep the domain type only if persisted/external data needs it.

Do not enable Seer assignment until the complete private server-to-mobile path exists.

### 14. Finalize victory rules

- [ ] Decide whether werewolves win at parity (`werewolves >= other living players`) or
      only under the current narrower conditions. Encode the chosen rule in a complete
      table-driven test matrix.
- [ ] Define the victory condition for cross-team lovers and same-team lovers.
- [ ] Define an abandoned/no-active-player outcome.
- [ ] Ensure an empty lobby cannot report a village victory.
- [ ] Include the result reason in the final event payload. (The winning faction and
      role reveal are added by task 27; extend that payload rather than adding a new
      event.)

### 15. Decide day-vote tie behavior

- [ ] Keep and clearly present the current nobody-dies rule, or implement the design in
      `plans/027-revote-on-tie-spike.md`.
- [ ] If implementing revotes, define maximum rounds and a final fallback so ties cannot
      loop forever.
- [ ] Test two-way, multi-way, repeated, and disconnect-during-revote ties.

## P2: Contract and test hardening

### 16. Clean up and strengthen the shared socket contract

- [ ] Replace ambiguous string fields with clearly named payload objects. Distinguish
      player ID, socket ID, display name, and yes/no choices. Use branded IDs if useful.
- [ ] Correct `alert:player-is-lover`, which is typed/rendered as a name but currently
      receives a socket ID.
- [ ] Remove the unused server-to-client `hunter:killed-player` declaration.
- [ ] Remove unused client-to-server `alert:hunter-died` and testing-direction
      `werewolf:current-votes`, unless a concrete producer/consumer is added.
- [ ] Complete `plans/026-delete-admin-simulate-day-vote.md`.
- [ ] Type Socket.IO acknowledgements for success and recoverable errors.
- [ ] Add contract-level type tests or fixtures used by server, mobile, and dashboard.

### 17. Add end-to-end gameplay tests

- The happy-path integration test and deterministic role assignment moved to task 28;
  build on that test here rather than writing a second harness.
- [ ] Cover invalid targets, unauthorized roles, stale events, duplicates, late joins,
      disconnect/reconnect, timeouts, and action-after-finish.
- [ ] Add meaningful assertions to segment-manager tests; do not leave transition tests
      commented out.
- [ ] Complete `plans/018-mobile-dashboard-test-infra.md` and test mobile socket hooks,
      modal payloads, stores, death spectating, and reset behavior.
- [ ] Retain the randomized server simulations as supplemental coverage, not as a
      substitute for the live socket lifecycle test.

### 18. Repair dashboard testing controls

- [ ] Fix “Simulate Wolf Vote” to send a player ID/SID rather than a display name.
- [ ] Ensure mock-player werewolf prompts and votes use each mock player's socket rather
      than relying only on global/manual shortcuts.
- [ ] Track and display winner/loser terminal state for mock players.
- [ ] Make dashboard environment-variable behavior consistent between global and mock
      sockets.
- [ ] Finish useful event logging and remove stale/no-op controls.
- [ ] Keep dashboard admin events clearly development-only and prevent their use in a
      production deployment.

## P3: Deployment, maintenance, and polish

### 19. Deployment safety

- [ ] Complete `plans/023-restrict-socket-cors.md`.
- [ ] Add authorization for admin/mock events or compile/disable them outside development.
- [ ] Add rate limits and payload-size limits for join and gameplay events.
- [ ] Validate all runtime event payloads; TypeScript types alone do not validate network
      input.
- [ ] Add structured logging for game ID, player ID, phase transitions, rejected actions,
      disconnects, and resolution errors without logging private tokens.
- [ ] Add a top-level error boundary/recovery policy so one malformed action cannot crash
      or strand the process.

### 20. Audio and presentation

- [ ] Restore or deliberately remove the intro-audio TODO in
      `apps/server/src/segments/segments-manager.ts`.
- [ ] Verify audio ordering for first night, ordinary nights, dawn, ties, Hunter waits,
      and both victory outcomes.
- [ ] Ensure audio failures do not block phase progression.
- [ ] Add reduced-motion/accessibility behavior and clear French copy for all new states.

### 21. Repository cleanup after gameplay is stable

- [ ] Complete relevant remaining plans: 012, 013, 015, 016, 017, 019, 020, and 021.
- [ ] Do not complete plan 014 merely to repair dead Effect handlers unless the Effect
      migration is actively resumed.
- [ ] Reconcile or remove the parallel Effect socket handler implementation before it is
      wired in; it currently lacks parity with live authorization and disconnect behavior.
- [ ] Only switch the dev script to `index.effect.ts` after lifecycle, socket handlers,
      restart, tests, and behavior all match the live entry point.
- [ ] Update `README.md`, `DOCUMENTATION.md`, `PLAN.md`, and `plans/README.md` to reflect
      the final supported roles, run commands, lifecycle, and completed work.

## Existing work that should not be repeated

The following plans are marked DONE in `plans/README.md`: 001-007, 010-011, 022, 024,
and 028. Preserve their behavior unless a task above deliberately replaces it. In
particular, server-side role checks and disconnect bookkeeping already exist, but they
must be extended with phase validation, stable identity, grace periods, and resync rather
than reimplemented as unrelated parallel systems.

## Suggested delivery milestones

- [x] **Milestone A, local playable game:** tasks 1-4 and 8 pass with six continuously
      connected mobile clients. (All task items are checked; task 28's live-socket test
      is the verification gate for this box.)
- [x] **Milestone A.5, family playtest:** tasks 22-28 pass. A real group of 4+ people in
      one room can play complete games back to back on their phones, with dead players
      reaching the result screen and roles revealed at the end.
- [ ] **Milestone B, reliable party game:** tasks 5-11 pass, including reconnect,
      deadlines, spectating, results, and replay.
- [ ] **Milestone C, complete rules:** tasks 12-15 are decided and implemented.
- [ ] **Milestone D, releasable build:** tasks 16-21 pass and all workspace verification
      commands are green.
