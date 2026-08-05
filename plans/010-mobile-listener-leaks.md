# Plan 010: Fix mobile `use-game-events.ts` socket listener leaks across re-renders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/hooks/use-game-events.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`use-game-events.ts` registers 8+ socket listeners inside a `useEffect`
whose cleanup function only removes 3. The dependency array
`[modalState.open, setModalState, playerIsDead, router]` re-runs the effect
on every modal open/close, stacking the 5 un-cleaned listeners
(`cupid:pick-required` (`.once`), `alert:player-is-lover` (`.once`),
`witch:can-heal`, `hunter:pick-required`, `alert:player-is-dead`). Each
`alert:player-is-dead` handler fires on every death and re-runs
`playerIsDead()` + `router.replace('/death-screen')`; duplicate navigation
and state mutations happen on every modal event. The `.once` listeners
re-register on each re-run, so they fire again if the server re-emits.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/mobile/hooks/use-game-events.ts` — the full hook is ~84 lines. Key parts:
  - Lines 14-77 register the listeners inside `useEffect`.
  - Lines 72-76 cleanup only removes `werewolf:pick-required`, `alert:player-won`, `alert:player-lost`. Missing: `cupid:pick-required`, `alert:player-is-lover`, `witch:can-heal`, `hunter:pick-required`, `alert:player-is-dead`.
  - Lines 15-21 and 22-28 use `socket.once` for cupid and lover alerts; `.once` does NOT auto-remove if the event never fires before the effect re-runs (it stays attached until triggered).
  - Lines 44-50 hunter handler and lines 36-42 witch handler use `socket.on` (steady-state) but are never cleaned.
  - Lines 52-60 `alert:player-is-dead` handler is never cleaned — this one is the most user-visible (duplicate death-screen navigations).
  - Line 77 the dep array:
    ```ts
    }, [modalState.open, setModalState, playerIsDead, router]);
    ```

- `apps/mobile/utils/sockets.ts` — exports a single `socket` client instance (`io(backendUrl, ...)`). Listeners on it are global to the app.

### Repo conventions to follow

- Match `use-game-store.ts:150-158` `cleanupSocketListeners` — full `socket.off(...)` per event name, explicitly quoted.
- Mobile uses Zustand; `setModalState` is a stable action reference from the Zustand store (changes only if the store is re-created). `playerIsDead` from `usePlayerStore` is also a stable action. `router` from `useRouter()` is stable across renders. Only `modalState.open` legitimately changes — but we don't need to re-register listeners when a modal opens/closes; we need them registered once for the lifetime of the component. Remove `modalState` from deps and the handler reads it via a ref if needed (or eliminate the `modalState.open` read in `alert:player-is-dead`).
- Note `alert:player-is-dead` handler reads `modalState.open` (line 55) to decide whether to defer the redirect. Either keep a ref or move that logic out — see Step 2.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm --filter mobile tsc --noEmit`  | exit 0 (IF mobile has a check-types script — plan 002 wires it; if not yet landed, run `pnpm --filter mobile typecheck`; STOP if that errors with "no such script") |
| Mobile run| `pnpm --filter mobile dev`           | (manual verification only; don't start it) |

Note: mobile has no test runner today — plan 018 adds one. This plan relies on typecheck + code-read verification.

## Scope

**In scope**:
- `apps/mobile/hooks/use-game-events.ts`

**Out of scope**:
- `use-game-store.ts` (its own `initializeSocketListeners` cleanup is handled by the game-interface / waiting-room cleanup path — plan 011 fixes `waiting-room.tsx`).
- `use-modal-store.ts`.
- Adding a test runner to mobile (= plan 018).
- The day-vote / death-announced wiring (= plans 024/025) — they'll use the now-stable listener list as their anchor.

## Git workflow

- Branch: `advisor/010-mobile-listener-leaks`
- Conventional commits — e.g. `fix: clean up all socket listeners in use-game-events to prevent stacking`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Use `useRef` for `modalState.open` to decouple the dead handler from the dep array

In `apps/mobile/hooks/use-game-events.ts`, at the top of the hook (after the existing store hooks):

```ts
import { useEffect, useRef, useState } from 'react';

export function useGameEvents() {
  const [werewolvesVictim, setWerewolvesVictim] = useState<string | null>(null);
  const [pendingRedirect, setPendingRedirect] = useState(false);
  const { playerIsDead } = usePlayerStore();
  const { setModalState, modalState } = useModalStore();
  const router = useRouter();

  // Keep latest modalState.open accessible inside long-lived socket
  // handlers without re-subscribing listeners on every open/close toggle.
  const modalOpenRef = useRef(modalState.open);
  useEffect(() => {
    modalOpenRef.current = modalState.open;
  }, [modalState.open]);
  // ...
```

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 2: Move all listeners behind one cleanup, stable deps

Rewrite the `useEffect` so it registers every listener once and removes every one of them in cleanup. The dependency array drops `modalState.open` (now read via ref); leave `setModalState`, `playerIsDead`, `router` (all stable Zustand/`useRouter` references):

```ts
useEffect(() => {
  socket.once('cupid:pick-required', () => {
    setModalState({ type: 'CUPID', open: true });
  });

  socket.once('alert:player-is-lover', () => {
    setModalState({ type: 'LOVER', open: true });
  });

  socket.on('werewolf:pick-required', () => {
    setModalState({ type: 'WEREWOLVES', open: true });
  });

  socket.on('witch:can-heal', (victimSid: string) => {
    setWerewolvesVictim(victimSid);
    setModalState({ type: 'WITCH-HEAL', open: true });
  });

  socket.on('hunter:pick-required', () => {
    console.log('hunter alert received');
    setModalState({ type: 'HUNTER', open: true });
  });

  socket.on('alert:player-is-dead', () => {
    playerIsDead();
    if (modalOpenRef.current) {
      setPendingRedirect(true);
    } else {
      router.replace('/death-screen');
    }
  });

  socket.on('alert:player-won', () => {
    console.log('Player won the game!');
    router.replace('/winner-screen');
  });

  socket.on('alert:player-lost', () => {
    console.log('Player lost the game!');
    router.replace('/loser-screen');
  });

  return () => {
    socket.off('cupid:pick-required');
    socket.off('alert:player-is-lover');
    socket.off('werewolf:pick-required');
    socket.off('witch:can-heal');
    socket.off('hunter:pick-required');
    socket.off('alert:player-is-dead');
    socket.off('alert:player-won');
    socket.off('alert:player-lost');
  };
}, [setModalState, playerIsDead, router]);
```

Keep the `werewolvesVictim`, `pendingRedirect`, `setPendingRedirect` returns at the bottom of the hook unchanged.

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 3: Confirm other `socket.on` callers are unaffected

`apps/mobile/hooks/use-game-store.ts` `initializeSocketListeners` already handles its own set via `cleanupSocketListeners` — don't touch. `apps/mobile/utils/sockets.ts` has `socket.on('connect')` / `socket.on('connect_error')` at the module level (never need cleaning for the app lifetime) — leave as-is.

**Verify**: `grep -n "socket.on\|socket.once" apps/mobile/hooks/use-game-events.ts` — only matches inside the `useEffect`.

### Step 4: Manual check that no double-registration happens

Compare with the original lines 72-76 cleanup — the new cleanup removes 8 events instead of 3. Count them in the new version.

**Verify**: count `socket.off(...)` calls in the hook cleanup — should be 8.

## Test plan

- No automated tests in this plan — mobile has no test runner (= plan 018 wires vitest). Verify by code-read: the cleanup list matches the registration list exactly, and the dep array no longer triggers re-runs on modalState toggles.
- If plan 018 has already landed when this executes, write a vitest test using `socket.io-mock` that calls the hook twice (simulating re-mount or dep change), emits `alert:player-is-dead`, and asserts the handler runs exactly once.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile tsc --noEmit` exits 0 (or `pnpm --filter mobile check-types` if plan 002 has landed)
- [ ] `grep -c "socket.off(" apps/mobile/hooks/use-game-events.ts` returns 8
- [ ] `grep -c "socket.on\|socket.once" apps/mobile/hooks/use-game-events.ts` returns 8
- [ ] `grep -n "modalState.open" apps/mobile/hooks/use-game-events.ts` does NOT appear inside the listener registration `useEffect`'s dependency array (only in the `modalOpenRef` sync effect)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `apps/mobile/package.json` has neither `check-types` nor `typecheck` script — STOP and confirm whether plan 002 has landed; if not, run `npx tsc --noEmit -p apps/mobile/tsconfig.json` as a fallback and report the command you used.
- `useRef` is shadowed / `modalState.open` shape changed (it's a boolean today).
- The existing `socket.once` for cupid or lover alerts intentionally persists across re-renders so a re-mount restores the listener — confirm and report if so; the current code already re-registers `.once` on each effect run, so behavior after this fix is the same (registered once per mount lifetime).

## Maintenance notes

- Plans 024 (day-vote) and 025 (night:deaths-announced) will add new `socket.on` listeners to this file; each new listener MUST be paired with a matching `socket.off` in the cleanup block — keep that pattern as the file evolves.
- If `use-game-events` ever needs to read a transitory state inside a steady-state listener, use the `modalOpenRef`-style ref pattern (mirror via small `useEffect` on the changing dep), not by adding it to the listeners' dep array — that's the foot-gun that caused this leak.
- Plan 011 (`waiting-room.tsx` cleanup) is complementary; when both land, mobile client socket handlers are stable across the app lifecycle.