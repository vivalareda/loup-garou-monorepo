# Plan 024: Wire `day:voting-phase-start` into the mobile client so players can actually vote

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/hooks/use-game-events.ts apps/mobile/app/(game)/game-interface.tsx apps/mobile/hooks/use-modal-store.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (exercises an untested render branch for the first time; the modal may have stale assumptions about the player list shape)
- **Depends on**: plan 010 (mobile listener-leak fix — same `useEffect`, must land first or merge cleanly) AND plan 011 (waiting-room cleanup — for `villagersList` to be populated accurately on mobile)
- **Category**: direction
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The day vote is the core social-deduction mechanic — the village eliminates a
suspected werewolf after dawn. The server emits `day:voting-phase-start`
(`game-actions.ts:129`) and the dashboard mock players already handle it
(`mock-players.ts:215`). The mobile client has the modal code ready
(`game-interface.tsx:243-245`, `DAY-VOTE` modal in `use-modal-store.ts:10`)
AND already emits `day:player-voted` (`game-interface.tsx:203`). But
`use-game-events.ts` has **no listener** for `day:voting-phase-start` — the
modal is dead code, the voting UI never opens, and the actual player client
can't participate in the day vote. A real 6-player game cannot advance past
the first night on real handsets (only the dashboard can drive it).

This plan adds the missing listener and confirms the modal wiring works
against the real server.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/core/game-actions.ts:128-131` — emits:
  ```ts
  async dayAction() {
    this.game.processPendingDeaths();
    const winner = this.game.checkIfWinner();
    if (winner) { ... return; }
    setTimeout(() => {
      this.io.emit('day:voting-phase-start');
    }, 7000);
  }
  ```
  7-second delay between dawn and the vote begin (audio timing).

- `apps/mobile/hooks/use-game-events.ts:14-77` — the `useEffect`. Listens for `cupid:pick-required`, `alert:player-is-lover`, `werewolf:pick-required`, `witch:can-heal`, `hunter:pick-required`, `alert:player-is-dead`, `alert:player-won`, `alert:player-lost`. **No** `day:voting-phase-start`.

- `apps/mobile/hooks/use-modal-store.ts` — defines a `DAY-VOTE` modal type (≈ line 10).

- `apps/mobile/app/(game)/game-interface.tsx:194-206` — the `handleDayVoteModal` is already implemented:
  ```ts
  const handleDayVoteModal = () => {
    openModal({
      type: 'selection',
      title: 'Qui voulez-vous éliminer?',
      data: playersList
        .filter((p) => p.socketId !== player?.socketId)
        .map((p) => p.socketId),
      selectionCount: 1,
      onConfirm: (selectedPlayer: string) => {
        socket.emit('day:player-voted', selectedPlayer);
      },
    });
  };
  ```
- `apps/mobile/app/(game)/game-interface.tsx:243-245` — switch case exists:
  ```ts
  case 'DAY-VOTE':
    handleDayVoteModal();
    break;
  ```
  The case is in place; nothing calls `setModalState({ type: 'DAY-VOTE', open: true })`.

- The dashboard mock handles `day:voting-phase-start` at `apps/dashboard/src/store/mock-players.ts:215-234` — emits `day:player-voted` per alive mock player. Useful as an integration-check exemplar for what the listener should set up.

- Mobile uses `villagersList` to populate the werewolf modal (`game-interface.tsx:174`) but the day-vote modal uses `playersList` filtered by `socketId !== player?.socketId` — note: doesn't exclude dead players in the listing currently (would be a follow-up; for now the server is the source of truth on validity per plan 006's role-alive check).

### Repo conventions to follow

- Use `socket.on(...)` symmetric with `socket.off(...)` in the `use-game-events.ts` cleanup (per plan 010's pattern — if plan 010 has landed, mirror its stable-deps + ref pattern; otherwise, sym off the new listener in cleanup).
- Use `setModalState({ type: 'DAY-VOTE', open: true })` — the same shape the existing handlers use.
- Don't mutate `use-modal-store.ts` or `use-player-store.ts` here — the modal type already exists.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm --filter mobile tsc --noEmit`  | exit 0 (or `pnpm --filter mobile check-types` if plan 002 / 018 has landed) |

## Scope

**In scope**:
- `apps/mobile/hooks/use-game-events.ts` — add a `socket.on('day:voting-phase-start', ...)` listener that calls `setModalState({ type: 'DAY-VOTE', open: true })` and add the matching `socket.off('day:voting-phase-start')` to the cleanup.

**Out of scope**:
- `apps/mobile/app/(game)/game-interface.tsx` — the modal handler already exists; leave it.
- `apps/mobile/hooks/use-modal-store.ts` — modal type existing; leave it.
- Server changes — `day:voting-phase-start` already emits correctly; Cross-app verify via the dashboard mock.
- Filter dead players from the `playersList` in the day-vote modal — that's a minor follow-up UX polish; mention in maintenance notes but don't change it here (preserves the diff to one listener addition).

## Git workflow

- Branch: `advisor/024-wire-day-voting-phase-start`
- Conventional commits — e.g. `feat(mobile): open the day-vote modal when server signals voting phase`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `day:voting-phase-start` listener

In `apps/mobile/hooks/use-game-events.ts` in the `useEffect`, alongside the existing `socket.on('werewolf:pick-required', ...)` etc., add:

```ts
socket.on('day:voting-phase-start', () => {
  setModalState({ type: 'DAY-VOTE', open: true });
});
```

Place it near the other role/phase handlers (e.g. after `witch:can-heal` and `hunter:pick-required`).

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 2: Register the matching cleanup

In the same `useEffect`'s return cleanup function, add:

```ts
socket.off('day:voting-phase-start');
```

If plan 010 has landed, the cleanup block already contains 8 `socket.off(...)` lines — add this one as a 9th. If plan 010 has NOT landed yet (so the cleanup only removes 3 listeners), add this one; just don't accidentally skip the others' missing cleanups just because this plan touches the same file — coordinate with the plan 010 merge.

**Verify**: `grep -c "socket.off(" apps/mobile/hooks/use-game-events.ts` reflects the new addition; the on/off counts balance.

### Step 3: Verify the modal handler resolves

Read `apps/mobile/app/(game)/game-interface.tsx:194-245` and confirm:
- `handleDayVoteModal` exists (already does).
- `modalState.type === 'DAY-VOTE'` dispatches to `handleDayVoteModal` (already does at line 243).
- `playersList` and `player` are in scope in the `useEffect` dep array for the modal handler (already are).

If any of these don't match the current state — STOP and report (drift since this plan was written).

**Verify**: `grep -n "DAY-VOTE" apps/mobile/app/(game)/game-interface.tsx` returns the existing case; no edit needed there.

### Step 4: Manual end-to-end check (record outcome in NOTES)

If feasible, end-to-end smoke:
1. Start the server (`pnpm dev:server`).
2. Start the dashboard (`pnpm dev:dashboard`).
3. Open the mobile app, connect as Player1.
4. Use the dashboard mock-player flow to start a game (six players via admin or batch), simulate werewolf vote, advance through to day.
5. Confirm the mobile app shows the day-vote modal.
6. Tap a target, confirm `day:player-voted` reaches the server (logs `Player <sid> voted to eliminate <sid>`).

A green-screen capture is a nice-to-have; otherwise, record the manual rundown status.

## Test plan

- No new automated tests in this plan (mobile test infra = plan 018; if plan 018 has landed, a vitest harness mocking `socket.emit` could simulate the phase-start event and assert `setModalState` was called with the right shape — optional but a strong gate).
- If mobile test infra is live: add a `use-game-events.test.ts` that mocks `socket`, emits `day:voting-phase-start`, asserts `setModalState` was called with `{ type: 'DAY-VOTE', open: true }`. Use the existing `use-game-store` tests (if any) as the harness pattern.
- Manual verification per Step 4 is the primary gate.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile tsc --noEmit` exits 0
- [ ] `grep -c "socket.on('day:voting-phase-start'" apps/mobile/hooks/use-game-events.ts` returns 1
- [ ] `grep -c "socket.off('day:voting-phase-start')" apps/mobile/hooks/use-game-events.ts` returns 1
- [ ] `grep -n "DAY-VOTE" apps/mobile/hooks/use-game-events.ts apps/mobile/app/(game)/game-interface.tsx apps/mobile/hooks/use-modal-store.ts` returns at least 3 matches across the three files (the new listener, the modal handler, the existing modal type definition)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification recorded in NOTES (success or skipped + reason)

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 010 has not landed and the cleanup block at `use-game-events.ts:72-76` still only removes 3 listeners — STOP, coordinate by landing plan 010 first OR fold this plan's listener + its cleanup into the plan 010 diff. Don't land this plan on top of the broken cleanup.
- `use-modal-store.ts` no longer defines `DAY-VOTE` as a modal type — STOP; the modal handler at `game-interface.tsx:243` would fail (`satisfies never` exhaustive switch catch).
- The `handleDayVoteModal` at `game-interface.tsx:194-206` has changed and now expects a different modal-data shape — confirm before wiring the new listener.
- The server's `day:voting-phase-start` event name or payload type changed in `packages/types/src/event.ts` — STOP, refresh the plan.
- The `playersList` filter at `game-interface.tsx:199` excludes the local `player?.socketId` but doesn't exclude dead players — record this as a follow-up UX issue; don't fix in this plan (scope is just the listener).

## Maintenance notes

- A follow-up plan should exclude dead players from the day-vote modal's target list (filter on `isAlive` once the mobile client tracks that). The server is the source of truth — plan 006 rejects dead-target votes anyway.
- `night:deaths-announced` wiring (= plan 025) is the next client-side visibility gap; pairs well after this.
- When the day-vote tie UX (= plan 027) lands, this listener handler may need a separate modal variant that handles the tie case (`day:vote-tie` event). Plan that when the tie-rule-by-law is decided.
- If multi-room / multi-game support is added, the mobile app needs to know which room's day-voting phase this is; today single-room assumption is fine.