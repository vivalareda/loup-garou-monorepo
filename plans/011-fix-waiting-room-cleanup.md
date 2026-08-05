# Plan 011: Fix `waiting-room.tsx` missing `cleanupSocketListeners` call

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/app/(game)/waiting-room.tsx`
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

`waiting-room.tsx:13-15` calls `initializeSocketListeners()` on mount but
does not return (or call) `cleanupSocketListeners()`. When navigation
moves from the waiting room to the game interface on role assignment
(`waiting-room.tsx:17-21`), waiting room unmounts but its 7 listeners
(`lobby:players-list`, `lobby:update-players-list`, `lobby:player-died`,
`player:role-assigned`, `lobby:villagers-list`, `werewolf:current-votes`,
`werewolf:voting-complete`) stay registered. The game-interface's
`useGameStore()` hook then calls `initializeSocketListeners()` again,
registering all 7 a second time. Every event fires twice — e.g.
`lobby:update-players-list` pushes the same player double into
`playersList`; `player:role-assigned` triggers `setRole` twice.

## Current state

All paths relative to repo root.

- `apps/mobile/app/(game)/waiting-room.tsx` — the full file (~41 lines). Relevant excerpt:
  ```tsx
  export default function WaitingRoom() {
    const { playersList, roleAssigned, initializeSocketListeners } =
      useGameStore();
    const { player } = usePlayerStore();
    const router = useRouter();

    useEffect(() => {
      initializeSocketListeners();
    }, [initializeSocketListeners]);

    useEffect(() => {
      if (roleAssigned) {
        router.push('/(game)/game-interface');
      }
    }, [router, roleAssigned]);
    // ...
  }
  ```

- `apps/mobile/app/(game)/game-interface.tsx:40-44` — the exemplar cleanup:
  ```tsx
  useEffect(() => {
    socket.emit('lobby:get-players-list');
    initializeSocketListeners();
    return cleanupSocketListeners;
  }, [initializeSocketListeners, cleanupSocketListeners]);
  ```
  That's the pattern to mimic in `waiting-room.tsx`.

- `apps/mobile/hooks/use-game-store.ts:150-158` — `cleanupSocketListeners` already exists and removes all 7 listeners:
  ```ts
  cleanupSocketListeners: () => {
    socket.off('lobby:players-list');
    socket.off('lobby:update-players-list');
    socket.off('lobby:player-died');
    socket.off('player:role-assigned');
    socket.off('lobby:villagers-list');
    socket.off('werewolf:current-votes');
    socket.off('werewolf:voting-complete');
  }
  ```

- `apps/mobile/hooks/use-game-store.ts:107-147` — `initializeSocketListeners` registers exactly those 7.

### Repo conventions to follow

- The exemplar pattern in `game-interface.tsx:40-44`: return `cleanupSocketListeners` directly as the `useEffect` cleanup.
- Pure, mechanical fix — don't refactor the navigation logic or hoist the store hook.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm --filter mobile tsc --noEmit`  | exit 0 (or STOP per plan 010 note if scripts not present) |

## Scope

**In scope**:
- `apps/mobile/app/(game)/waiting-room.tsx` — add `cleanupSocketListeners` to the store destructure + return it as the `useEffect` cleanup.

**Out of scope**:
- `game-interface.tsx` (already correct; only an exemplar).
- The `useGameStore` actions themselves.
- Mobile test setup (= plan 018).

## Git workflow

- Branch: `advisor/011-fix-waiting-room-cleanup`
- Conventional commits — e.g. `fix: cleanup waiting-room socket listeners on unmount`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Destructure cleanup and return it from the effect

In `apps/mobile/app/(game)/waiting-room.tsx`:

```tsx
export default function WaitingRoom() {
  const { playersList, roleAssigned, initializeSocketListeners, cleanupSocketListeners } =
    useGameStore();
  const { player } = usePlayerStore();
  const router = useRouter();

  useEffect(() => {
    initializeSocketListeners();
    return cleanupSocketListeners;
  }, [initializeSocketListeners, cleanupSocketListeners]);

  useEffect(() => {
    if (roleAssigned) {
      router.push('/(game)/game-interface');
    }
  }, [router, roleAssigned]);
  // ... rest unchanged
}
```

Nothing else in the component changes.

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0.

### Step 2: Confirm the event set symmetric

Match the pattern mentally: `initializeSocketListeners` registers 7 events, `cleanupSocketListeners` removes the same 7 (verified in current-state). The fix is complete.

## Test plan

- No automated tests in this plan (mobile has no test runner; plan 018 wires one). Code-read verification: the `useEffect` now returns a cleanup that removes exactly the events `initializeSocketListeners` registers — same set as the exemplar in `game-interface.tsx:40-44`.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile tsc --noEmit` exits 0 (or run `npx tsc --noEmit -p apps/mobile/tsconfig.json` if plan 002 hasn't landed yet)
- [ ] `grep -n "cleanupSocketListeners" apps/mobile/app/(game)/waiting-room.tsx` returns two matches: one in the store destructure, one as the `useEffect` return
- [ ] `grep -n "return cleanupSocketListeners" apps/mobile/app/(game)/game-interface.tsx` is unchanged (exemplar backstop)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `useGameStore` no longer exposes `cleanupSocketListeners` — STOP and report; the action may have been renamed.
- `apps/mobile/app/(game)/waiting-room.tsx` has been restructured (e.g. split into a different hook) — STOP and report what changed so the plan can be refreshed.

## Maintenance notes

- If a future plan extracts game-store listeners to a shared provider (so the waiting-room and game-interface share one registration), this cleanup pattern can be moved into the provider's `useEffect`. Until then, both call sites must mirror the same `initialize` / `cleanup` pair.
- Plan 010 (use-game-events.ts cleanup) is complementary — when both land, no socket listener on mobile leaks on screen transitions.