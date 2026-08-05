# Plan 012: Use per-field Zustand selectors in mobile screens to stop whole-store re-renders

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/app apps/mobile/hooks apps/mobile/components`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (mechanical switch to selectors)
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`useGameStore()` and `useModalStore()` are called with bare destructures
across mobile screens. Zustand only short-circuits re-renders when a
selector returns the same reference by-value; bare `useStore()` subscribes
to the ENTIRE state object, so any mutation (someone joins, a vote updates,
a modal opens) re-renders every component hanging off the store,
regardless of whether they consume the changed field. In a real-time
voting game where `werewolfVotes` and `playersList` update per socket tick,
this causes unnecessary native re-renders across every visible screen.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/mobile/app/(game)/waiting-room.tsx:8` — `const { playersList, roleAssigned, initializeSocketListeners } = useGameStore();`
- `apps/mobile/app/(game)/game-interface.tsx:27-32` — `const { playersList, villagersList, initializeSocketListeners, cleanupSocketListeners } = useGameStore();`
- `apps/mobile/app/(game)/game-interface.tsx:35` — `const { openModal, modalState } = useModalStore();`
- (Possibly other call sites — Step 2 includes grepping the whole `apps/mobile` tree for the patterns.)

- `apps/mobile/hooks/use-game-store.ts:41` — Zustand store definition with `create<GameState>((set, get) => ...)`. Actions are stable (defined once by the store), so selecting them with a stable selector returns the same reference — eligible for render-skip.

### Repo conventions to follow

- Use Zustand's `useStore((s) => s.field)` / `useGameStore((s) => s.playersList)` selector pattern.
- For selecting multiple fields that may change independently, prefer multiple selector calls (one per field) — returns the same reference per field on render-skip.
- For action pairs (functions that never change identity), Zustand allows a single `useShallow` from `zustand/shallow` to avoid re-renders; BUT since identity-stable actions already return the same reference, a bare selector (`useGameStore((s) => s.initializeSocketListeners)`) is sufficient for actions. We avoid introducing `useShallow` unless required.
- Don't import a new library — Zustand 5 ships the selector API.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Typecheck | `pnpm --filter mobile tsc --noEmit`  | exit 0 (or `npx tsc --noEmit -p apps/mobile/tsconfig.json` if mobile has no `check-types` / `typecheck` script yet — plan 002 wires it) |

## Scope

**In scope**:
- `apps/mobile/app/(game)/waiting-room.tsx`
- `apps/mobile/app/(game)/game-interface.tsx`
- Any other file under `apps/mobile/app/` or `apps/mobile/components/` that destructures `useGameStore` / `useModalStore` / `usePlayerStore` bare.

**Out of scope**:
- The store definitions themselves (`use-game-store.ts`, `use-modal-store.ts`, `use-player-store.ts`) — leave their action signatures intact.
- Dashboard store (= performance is less critical for the dev tool — separate plan).
- Adding mobile test infra (plan 018).

## Git workflow

- Branch: `advisor/012-mobile-zustand-selectors`
- Conventional commits — e.g. `perf(mobile): use per-field selectors for Zustand stores`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory all bare store destructures

Run `rg -n "use(GameStore|ModalStore|PlayerStore)\(\)" apps/mobile/app apps/mobile/components apps/mobile/hooks` to find every bare call. Record the list; the plan covers all of them.

**Verify**: the grep output lists every call site to convert.

### Step 2: Convert each call site to per-field selectors

Pattern (for `game-interface.tsx:27-32`):

```tsx
const playersList = useGameStore((s) => s.playersList);
const villagersList = useGameStore((s) => s.villagersList);
const initializeSocketListeners = useGameStore((s) => s.initializeSocketListeners);
const cleanupSocketListeners = useGameStore((s) => s.cleanupSocketListeners);
```

For `waiting-room.tsx:8`:

```tsx
const playersList = useGameStore((s) => s.playersList);
const roleAssigned = useGameStore((s) => s.roleAssigned);
const initializeSocketListeners = useGameStore((s) => s.initializeSocketListeners);
const cleanupSocketListeners = useGameStore((s) => s.cleanupSocketListeners);
```
(Leave the `cleanupSocketListeners` addition to plan 011 if it hasn't landed — coordinate by both plans touching `waiting-room.tsx`. This plan keeps the existing destructure set and only switches to selectors.)

For `game-interface.tsx:35`:

```tsx
const openModal = useModalStore((s) => s.openModal);
const modalState = useModalStore((s) => s.modalState);
```

For each remaining call site found in Step 1, apply the same selector-per-field pattern. Don't combine multiple action selectors into one — one line per field.

**Verify**: `pnpm --filter mobile tsc --noEmit` → exit 0 after each conversion.

### Step 3: Confirm hooks referencing `use-game-store.ts`'s internal `usePlayerStore.getState()` are unchanged

`use-game-store.ts` uses `usePlayerStore.getState()` and `useGameStore.getState()` internally (imperative, not the React selector API). Those are correct for use inside non-React callback bodies — don't change them.

**Verify**: `grep -n "getState()" apps/mobile/hooks/use-game-store.ts` and `apps/mobile/hooks/use-player-store.ts` — confirm no rule to standardize here.

## Test plan

- No new automated tests (mobile test infra = plan 018). Manual verify at runtime: when `werewolf:current-votes` updates rapidly, any visible component that only reads `playersList` should not visibly re-render. Hard to assert without Chrome DevTools Profiler; typecheck + code-read is the gate.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile tsc --noEmit` exits 0 (or fallback per STOP conditions)
- [ ] `rg -n "use(GameStore|ModalStore|PlayerStore)\(\)" apps/mobile/app apps/mobile/components` returns no matches (no bare destructure left)
- [ ] `rg -c "useGameStore\(\(s\) => s\." apps/mobile/app apps/mobile/components apps/mobile/hooks` returns matches showing selector usage
- [ ] No files outside the in-scope lists are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `apps/mobile/package.json` lacks `check-types` AND `typecheck` scripts — use `npx tsc --noEmit -p apps/mobile/tsconfig.json` and report the command you used.
- A call site destructures a field that's not stable — confirm by reading the store — and the destructure INTENTIONALLY uses the full state (e.g. it iterates all keys). Report and leave that one as bare.
- `useShallow` turns out to be required (e.g. a single hook subscription references >1 fields and action and passes the whole array to a downstream memo that depends on stable identity). STOP and report — the plan deliberately doesn't introduce `useShallow`; if it's needed, refresh the plan.

## Maintenance notes

- New mobile screens added after this plan should use the per-field selector pattern from day one — be vigilant in code review.
- If the dashboard ever shares these stores (e.g. by extracting a components package), apply the same pattern there.
- If a future plan adds a derived/computed field to `useGameStore` that changes every render, evaluate wrapping it with `useMemo` or splitting into a separate substore — selectors can't memoize derived state; only address the storage shape.