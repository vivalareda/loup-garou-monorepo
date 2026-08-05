# Plan 025: Surface `night:deaths-announced` to the mobile client so players see who died

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/hooks/use-game-events.ts apps/mobile/hooks/use-modal-store.ts apps/mobile/app/(game) packages/types/src/event.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plan 010 (mobile listener-leak fix — same file, additive)
- **Category**: direction
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

After a night, the server announces who died via `night:deaths-announced`
(`game-actions.ts:110`) with the typed `DeathInfo[]` payload
(`packages/types/src/death.ts`). The dashboard consumes it for logging
(`apps/dashboard/src/utils/socket.ts:40`) and `plans/README.md` explicitly
lists wiring this to clients as a parked item. Mobile has NO listener for
it — players only learn they died (via `alert:player-is-dead`) but get no
view of who else died. This is the most-watched moment of every Werewolf
round and it's invisible to the player client.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/server/src/core/game-actions.ts:109-117` — emits:
  ```ts
  announceNightDeaths(deaths: DeathInfo[]) {
    this.io.emit('night:deaths-announced', deaths);
    for (const death of deaths) {
      console.log(`Announcing death: Player ${death.playerId} died from ${death.cause}`);
    }
  }
  ```
  Caller at `game-actions.ts` and `night-dawn-resolution.ts` (returns DeathInfo[] from `processPendingDeaths`).

- `packages/types/src/event.ts:56` — `'night:deaths-announced': null as unknown as (deaths: DeathInfo[]) => void` typed in `ServerToClientEvents`.

- `apps/dashboard/src/utils/socket.ts:40-47` — consumes the event:
  ```ts
  socket.on('night:deaths-announced', (deaths: DeathInfo[]) => {
    gameEvents.deaths = deaths;
    gameEvents.logs.push(`💀 ${deaths.length} player(s) died during the night`);
    for (const death of deaths) {
      gameEvents.logs.push(`  💀 ${death.playerName} died from ${death.cause}`);
    }
  });
  ```

- `apps/mobile/hooks/use-game-events.ts` — NO listener for `night:deaths-announced` (grep confirms zero matches in `apps/mobile`).

- `apps/mobile/app/(game)/death-screen.tsx` — exists (the player's own death screen).

- `apps/mobile/hooks/use-modal-store.ts` — defines modal types; would need a new `NIGHT-DEATHS` modal type OR reuse a generic `confirm` modal that displays a list. Read `use-modal-store.ts` to confirm the modal system supports list-style data; if it only does `selection` and `yes-no`, add a new modal type `NIGHT-DEATHS` that just displays list-shaped data (analogous to existing `confirm`).

### Repo conventions to follow

- Reuse the `DeathInfo` type from `@repo/types` for the local store state (server already sends typed payload).
- Add the listener in `use-game-events.ts`, symmetrically with `socket.off('night:deaths-announced')` in cleanup (per plan 010 pattern).
- Modal pattern uses `setModalState({ type: 'NIGHT-DEATHS' (or similar), open: true });` plus data via store. If the existing modal store can't carry arbitrary payload, add a minimal slot (read first).
- Match the existing modal handler shape in `game-interface.tsx` (e.g. `handleNightDeathsModal`).

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm --filter mobile tsc --noEmit`  | exit 0              |
| Server tests | `pnpm --filter server test:run`  | 56 pass (unchanged server side) |

## Scope

**In scope**:
- `apps/mobile/hooks/use-game-events.ts` — add `socket.on('night:deaths-announced', ...)` listener + matching cleanup, persisting `DeathInfo[]` to local state.
- `apps/mobile/hooks/use-modal-store.ts` — add a `NIGHT-DEATHS` modal type if the existing set doesn't support list display. (Or — if `confirm` already supports arbitrary `data: ReactNode`, reuse that and skip adding a new type.)
- `apps/mobile/app/(game)/game-interface.tsx` — add a `handleNightDeathsModal` that displays the `DeathInfo[]` with names + causes, with a confirm/close. Match the existing modal handler pattern (`handleDayVoteModal`).
- `apps/mobile/hooks/use-game-store.ts` (optional) — if modal state can't carry the death list alone, add a `nightDeaths: DeathInfo[]` slot in the game store, set it from the listener, then render via the modal data prop.

**Out of scope**:
- Server changes — event already emits correctly with a typed payload.
- Dashboard (already wired).
- WIthout testing — the modal rendering path here is descriptive; no behavioral test without mobile test infra (= plan 018).

## Git workflow

- Branch: `advisor/025-wire-night-deaths-announced`
- Conventional commits — e.g. `feat(mobile): display night deaths announcement to all players`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Read the current modal store capabilities

Read `apps/mobile/hooks/use-modal-store.ts` to see the modal-state shape:
- Modal types are an enum (e.g. similar to `'CUPID' | 'WEREWOLVES' | ...`).
- `openModal({ type, title, data, buttonDelay?, onConfirm })` is the pattern.
- `data` is presumably `any` / `ReactNode`-ish. Confirm.

Decide: if `data` can carry a list of `{ name, cause }` objects, reuse the existing `confirm` modal type (don't add `NIGHT-DEATHS`). If `data` must be a selection array, add a new modal type `NIGHT-DEATHS` to the store.

**Record the decision in your final report.**

### Step 2a (if new modal type needed): Add `NIGHT-DEATHS` to `use-modal-store.ts`

Add the new type to the union, alongside initialization defaults so the exhaustive switch in `game-interface.tsx:212-249` stays satisfied. (Don't forget the switch case in Step 3.)

### Step 2b: Add the listener and local state in `use-game-events.ts`

In the hook, add local state:

```ts
import type { DeathInfo } from '@repo/types';
// ...
const [nightDeaths, setNightDeaths] = useState<DeathInfo[]>([]);
```

In the `useEffect` alongside existing listeners:

```ts
socket.on('night:deaths-announced', (deaths: DeathInfo[]) => {
  setNightDeaths(deaths);
  setModalState({ type: 'NIGHT-DEATHS', open: true });
});
```

If reusing `confirm` type, just pass the data inline: `setModalState({ type: 'confirm', title: 'La nuit a fait des victimes', data: <NightDeathsList deaths={deaths} />, open: true })` — but a dedicated modal type keeps the switch clear.

Add matching cleanup:

```ts
socket.off('night:deaths-announced');
```

Return `nightDeaths` (and `setNightDeaths` if needed for clearing) from the hook. Surface them to consumers the same way `werewolvesVictim` is currently exposed.

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 3: Add the `handleNightDeathsModal` in `game-interface.tsx`

In `apps/mobile/app/(game)/game-interface.tsx`, inside the modal `useEffect`'s switch:

```ts
case 'NIGHT-DEATHS':
  handleNightDeathsModal();
  break;
```

Define `handleNightDeathsModal` near `handleDayVoteModal`:

```ts
const handleNightDeathsModal = () => {
  const deathList = nightDeaths.length > 0 ?
    nightDeaths.map((d) => `${d.playerName} — ${d.cause}`).join(', ') :
    'Personne n\'est mort cette nuit.';
  openModal({
    type: 'confirm',
    title: 'La Nuit...',
    data: <View><Text style={{color: 'white'}}>{deathList}</Text></View>,
    onConfirm: () => {
      setNightDeaths([]);
    },
  });
};
```

Notes:
- Import `nightDeaths` + `setNightDeaths` from `useGameEvents()` (returned in Step 2b).
- Tailwind/native styles match `apps/mobile/app/(game)/death-screen.tsx` — use `bg-slate-900` text colors etc.
- Don't crash if `nightDeaths` is empty (e.g. the server still emits with an empty array when nobody died). Handle the "nobody died" case explicitly (or omit the modal if `deaths.length === 0` — see STOP conditions for a design choice).

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 4: Manual end-to-end (optional)

Same as plan 024's Step 4 — startup the server and dashboard mock, advance through night; observe the mobile app displaying the death list when the night ends.

## Test plan

- No new automated tests in this plan (mobile test infra = plan 018). Manual verification is the gate.
- If plan 018 has landed: add a vitest test that mocks `socket`, emits `night:deaths-announced` with a sample `DeathInfo[]`, asserts `setModalState` was called with `NIGHT-DEATHS` type and the death list in state.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile tsc --noEmit` exits 0
- [ ] `grep -c "socket.on('night:deaths-announced'" apps/mobile/hooks/use-game-events.ts` returns 1
- [ ] `grep -c "socket.off('night:deaths-announced')" apps/mobile/hooks/use-game-events.ts` returns 1
- [ ] `grep -n "NIGHT-DEATHS" apps/mobile/hooks/use-modal-store.ts apps/mobile/app/(game)/game-interface.tsx` returns matches in both files (type definition + switch case)
- [ ] `grep -n "import.*DeathInfo" apps/mobile/hooks/use-game-events.ts` returns a match
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification recorded in NOTES (success or skipped)

## STOP conditions

Stop and report back (do not improvise) if:

- The `use-modal-store.ts` doesn't allow adding new modal types cleanly (e.g. exhaustive switch in multiple files outside `game-interface.tsx`) — STOP, refresh the plan with the actual modal architecture. The modal architecture in this codebase is unusual; verify capacity before adding.
- The server's `night:deaths-announced` signature in `packages/types/src/event.ts` has drifted from `(deaths: DeathInfo[]) => void` — STOP, refresh the plan.
- The server's event emits with `deaths = []` when nobody died (look at the flow path): if so, decide whether to show an empty modal ("Personne n'est mort cette nuit.") or skip the modal entirely. Record the choice in NOTES. Skip may be safer — surface the modal only when `deaths.length > 0`.
- Adding a new modal type risks breaking the exhaustive `satisfies never` check in `game-interface.tsx:248` (e.g. the switch's `default` throws). Don't relax the `satisfies never`; add the `NIGHT-DEATHS` case.

## Maintenance notes

- A future plan should add a dedicated night-deaths screen (full-screen rather than modal) when the UX evolves; for now, reusing the modal keeps the diff small.
- When the day-vote tie modal (= plan 027) lands, the NIGHT-DEATHS and tie modals should share a "phase announcement" pattern — consider extracting then.
- Localize death-cause labels (currently `DeathCause` is `'WEREWOLVES' | 'PARTNER_SUICIDE'` etc. — user-facing labels should be French for the existing audience). A follow-up plan should add a `causeLabel` map; out of scope here.