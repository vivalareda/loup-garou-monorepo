# PRD: Remaining Segment Implementation

## Background
GameFlow currently implements the CUPID and LOVERS segments (plus basic WEREWOLF prompts). The remaining segments (WITCH-HEAL, WITCH-POISON, DAY_VOTE, HUNTER) and their supporting mechanics are not wired yet. This PRD covers the work needed to complete the segment loop, using the existing socket event contracts in `packages/types/src/event.ts`.

## Goals
- Complete server-side logic for WEREWOLF voting, WITCH-HEAL, WITCH-POISON, DAY_VOTE, and HUNTER segments.
- Preserve current Socket.io event contracts and segment types.
- Keep GameFlow as the single orchestrator for segment progression and audio.

## Non-Goals
- Implement SEER or new roles.
- Add persistence or multi-room support.
- Redesign client UI beyond event handling requirements.

## Tasks

### Shared game state and helpers
- [x] Shared state: add a PendingDeath/DeathInfo API (add, remove, list, clear).
- [x] Shared state: track witch potion availability (heal/poison) and reset on witch death.
- [x] Shared state: track werewolf votes and day votes using `vote-tallying.ts` helpers.
- [x] Shared state: expose winner detection using `win-conditions.ts`.
- [x] Shared state: add helper APIs for alive player lists, lover partners, and hunter status.

### WEREWOLF voting flow
- [x] WEREWOLF: validate werewolf voters and non-werewolf targets.
- [x] WEREWOLF: store per-werewolf votes and broadcast `werewolf:current-votes` after each vote.
- [x] WEREWOLF: detect unanimous consensus and emit `werewolf:voting-complete`.
- [x] WEREWOLF: add a `WEREWOLVES` pending death once consensus is reached.
- [x] WEREWOLF: finish the segment immediately after consensus.

### WITCH-HEAL
- [ ] WITCH-HEAL: skip the segment when there is no living witch or heal potion already used.
- [ ] WITCH-HEAL: when a werewolf victim exists, emit `witch:can-heal` with the victim SID.
- [ ] WITCH-HEAL: on `witch:healed-player`, remove the pending death and consume the heal potion.
- [ ] WITCH-HEAL: on `witch:skipped-heal`, continue without consuming a potion.

### WITCH-POISON
- [ ] WITCH-POISON: skip the segment when there is no living witch or poison potion already used.
- [ ] WITCH-POISON: emit `witch:pick-poison-player` when the segment starts.
- [ ] WITCH-POISON: on `witch:poisoned-player`, add a `WITCH_POISON` pending death and consume the potion.
- [ ] WITCH-POISON: on `witch:skipped-poison`, continue without consuming a potion.

### DAY_VOTE
- [ ] DAY_VOTE: process pending deaths before voting and emit `night:deaths-announced` with `DeathInfo[]`.
- [ ] DAY_VOTE: start voting after a short delay and emit `day:voting-phase-start`.
- [ ] DAY_VOTE: track votes from alive players only and reject dead voters.
- [ ] DAY_VOTE: resolve the vote, kill the selected player immediately (`DAY_VOTE`), and emit `lobby:player-died`.
- [ ] DAY_VOTE: handle vote ties (no elimination), clear votes, and continue to the next segment.
- [ ] DAY_VOTE: check win conditions after deaths, play winner audio, and emit win/lose alerts.

### HUNTER
- [ ] HUNTER: trigger the segment only when a hunter is in the pending death queue.
- [ ] HUNTER: emit `hunter:pick-required` and handle `hunter:killed-player`.
- [ ] HUNTER: add `HUNTER_REVENGE` pending death and process lover cascade if needed.
- [ ] HUNTER: resume the day flow after hunter resolution.

### Segment flow updates
- [ ] LOOP: mark CUPID and LOVERS as skipped after the first night.
- [ ] LOOP: auto-skip WITCH segments when the witch is dead or a potion is unavailable.
- [ ] LOOP: keep HUNTER conditional and non-blocking for the segment loop.
- [ ] LOOP: ensure segment order remains CUPID -> LOVERS -> WEREWOLF -> WITCH-HEAL -> WITCH-POISON -> DAY_VOTE (with HUNTER triggered when needed).

### Socket events and admin tools
- [ ] SOCKET: implement segment handlers in `apps/server/src/services/SocketHandlers.ts` for werewolf, witch, day, and hunter events.
- [ ] TYPES: keep event names and payloads aligned with `packages/types/src/event.ts`.

### Audio
- [ ] AUDIO: ensure `AudioManager` has mappings for WITCH-HEAL, WITCH-POISON, DAY_VOTE, and HUNTER.
- [ ] AUDIO: trigger winner audio via `AudioManager.playWinnerAudio` when `win-conditions.ts` resolves a winner.

### Testing
- [ ] TEST: unit tests for werewolf vote consensus and tallying.
- [ ] TEST: unit tests for day vote tie handling and vote clearing.
- [ ] TEST: unit tests for witch potion usage and death queue changes.
- [ ] TEST: integration test for a full night/day cycle with mock players.
- [ ] TEST: regression tests to ensure Cupid/Lovers flows remain intact.

## Acceptance Criteria
- A full segment loop runs without manual intervention using the dashboard mock players.
- All segment-specific socket events fire and are handled by the server.
- Winner detection and audio triggers behave correctly.
- Tests pass for segment flow and edge cases.

