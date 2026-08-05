# Plan 018: Add `check-types` script and vitest test runner to mobile and dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/mobile/package.json apps/dashboard/package.json apps/mobile/vitest.config.ts apps/dashboard/vitest.config.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW (additive only — new scripts and a test infra file)
- **Depends on**: plan 002 (fix check-types baseline — gets us a script name to mirror) but can land in parallel with the same script definition
- **Category**: dx, tests
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

Mobile and dashboard have **zero** test files and no test runner configured. Their Zustand stores do non-trivial conditional logic:

- `apps/mobile/hooks/use-game-store.ts:86` `sendVote` — first-vote vs update-vote branching.
- `apps/dashboard/src/store/mock-players.ts:446` `simulateAllWerewolfVotes` — SID lookup by name across many mock player lists.
- `apps/dashboard/src/store/mock-players.ts:620` `simulateAllDayVotes` — same pattern.
- `apps/dashboard/src/store/mock-players.ts:130` `player:role-assigned` — `WaitingRoomPlayer` → `GamePlayer` transition.

The mobile socket-listener lifecycle (= plans 010/011) and the dashboard mock-player lifecycle depend on these being correct. Without any test harness, every refactor is unverified.

This plan adds:
- A `check-types` script to both apps (if plan 002 hasn't landed — coordinate; this plan can land standalone with the same `tsc --noEmit` definition).
- A vitest config to both apps.
- One simple sanity test per app that the config is wired right (just a test that asserts a constant — proves the suite runs).

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `apps/mobile/package.json:5-12` — scripts: `dev, android, ios, prebuild, web, lint`. No `test`, no `check-types`. Dev deps include `typescript ~6.0.3`, no vitest.
- `apps/dashboard/package.json:6-10` — scripts: `dev, build, lint`. No `test`, no `check-types`. Dev deps include `typescript ~5.7.2`, vite `^6.1.0`, no vitest.
- `apps/server/vitest.config.js` — server's vitest config (the exemplar). Read it for the pattern:
  ```js
  // Example shape — read the actual file before copying
  import { defineConfig } from 'vitest/config';
  // ... vite-tsconfig-paths for @/ alias resolution ...
  ```
- `apps/server/package.json:14-15` — server has `"test": "vitest"`, `"test:run": "vitest run"`.
- `apps/server/package.json:30-31` — devDeps include `vitest ^3.2.4` and `vite-tsconfig-paths`.

### Repo conventions to follow

- Match `apps/server`'s vitest setup: `vitest` as the runner, `vitest.config.ts` (server uses `.js` — TS is fine for new apps), vite-tsconfig-paths to resolve `@/` aliases.
- Tests live alongside source in `__tests__/` folders (server uses `src/__tests__/` and `src/<module>/__tests__/`); for mobile/dashboard follow the same convention.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `pnpm install`                           | exit 0              |
| Mobile tests | `pnpm --filter mobile test:run`       | 1 test passes       |
| Dashboard tests | `pnpm --filter dashboard test:run` | 1 test passes       |
| Mobile types | `pnpm --filter mobile tsc --noEmit` (or `check-types` once 002 lands) | exit 0 |
| Dashboard types | `pnpm --filter dashboard tsc -b --noEmit` (or `check-types` once 002 lands) | exit 0 |

## Scope

**In scope**:
- `apps/mobile/package.json` — add `check-types`, `test`, `test:run` scripts + `vitest` + `vite-tsconfig-paths` devDeps.
- `apps/dashboard/package.json` — same additions.
- `apps/mobile/vitest.config.ts` — create (new file).
- `apps/dashboard/vitest.config.ts` — create (new file).
- `apps/mobile/__tests__/sanity.test.ts` — create, one trivial assertion proving the config works.
- `apps/dashboard/src/__tests__/sanity.test.ts` — create, likewise.

**Out of scope**:
- Adding tests for `use-game-store.ts` / `mock-players.ts` business logic (= a later plan, dependent on this infra).
- A CI workflow file (out of scope — separate effort).
- Updating turbo.json to register `test:run` as a turbo task (may be a small add; if it helps cross-app orchestration later, add a `test:run` task similar to `check-types`; not required for this plan's done criteria).
- The mobile/dashboards' existing `lint`/`build` scripts.

## Git workflow

- Branch: `advisor/018-mobile-dashboard-test-infra`
- Conventional commits — e.g. `chore(mobile,dashboard): add vitest and check-types scripts`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add scripts and devDeps to `apps/mobile/package.json`

In `apps/mobile/package.json` scripts, add:

```json
"check-types": "tsc --noEmit",
"test": "vitest",
"test:run": "vitest run"
```

In devDependencies (if not present):

```json
"vitest": "^3.2.4",
"vite-tsconfig-paths": "^5.1.4"
```

Match the server's pinned version (`^3.2.4` and `^5.1.4`) to avoid version drift; this also lets pnpm hoist.

**Verify**: `pnpm install` → exit 0.

### Step 2: Create `apps/mobile/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
  },
});
```

Notes:
- Use `environment: 'node'` for now — the sanity test doesn't need React/DOM components. When a future plan adds component tests, add `environment: 'jsdom'` (add `jsdom` as a devDep at that time) or use `@testing-library/react-native`. For this plan, `node` is sufficient.
- The include pattern matches the `__tests__/sanity.test.ts` we'll create in Step 5.

**Verify**: `pnpm --filter mobile test:run` (will fail because no test files yet — proceed).

### Step 3: Mirror Steps 1 & 2 for `apps/dashboard`

- Add the same three scripts to `apps/dashboard/package.json` (use the existing dashboard `tsc -b --noEmit` style for `check-types` if you mirror the server's plain `tsc --noEmit`; however `tsc -b --noEmit` is the project-reference flavor — if 002 plan land picked that, mirror it; either is fine, document your choice in NOTES).
- Add the same devDeps.
- Create `apps/dashboard/vitest.config.ts` with the same shape, but include pattern pointing at `src/__tests__/**/*.test.{ts,tsx}`.

**Verify**: `pnpm install` → exit 0.

### Step 4: Add sanity tests

- `apps/mobile/__tests__/sanity.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';

  describe('mobile vitest harness', () => {
    it('runs', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

- `apps/dashboard/src/__tests__/sanity.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';

  describe('dashboard vitest harness', () => {
    it('runs', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```

These are intentionally trivial — they prove the harness compiles and runs, and they unblock every future test plan.

### Step 5: Wire typecheck + tests; confirm both apps green

**Verify**:
- `pnpm --filter mobile check-types` → exit 0 (sanity test is fine with the app's TS config; if a backlog of real type errors appears, see STOP conditions).
- `pnpm --filter mobile test:run` → 1 test passes.
- `pnpm --filter dashboard check-types` → exit 0 (or STOP for tsconfig-project-reference compatibility — see STOP conditions).
- `pnpm --filter dashboard test:run` → 1 test passes.

## Test plan

- The tests written in Step 4 ARE this plan's deliverable. They assert trivial truths to prove the harness works. Subsequent plans can rely on `pnpm --filter <app> test:run` as a verification gate.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter mobile check-types` exits 0
- [ ] `pnpm --filter mobile test:run` exits 0; the sanity test is reported as 1 passing
- [ ] `pnpm --filter dashboard check-types` exits 0
- [ ] `pnpm --filter dashboard test:run` exits 0; the sanity test is reported as 1 passing
- [ ] `ls apps/mobile/vitest.config.ts apps/dashboard/vitest.config.ts apps/mobile/__tests__/sanity.test.ts apps/dashboard/src/__tests__/sanity.test.ts` shows all 4 files exist
- [ ] No source files outside the listed scope are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `apps/mobile` has a real TS backlog of errors on `tsc --noEmit` (more than 5 different errors) — STOP and report; this plan doesn't fix type errors. Write the infra anyway (= vitest config + scripts + sanity test) and record the backlog so future plan 019 (TypeScript version alignment) can land first. Document the error count in NOTES.
- `apps/dashboard` has a TS backlog like mobile — same handling.
- The existing `apps/server/vitest.config.js` uses `.js` (not `.ts`) and you're tempted to match — our new config is fine as `.ts` since vitest transpiles it. Don't change the server's existing file.
- `vite-tsconfig-paths ^5.1.4` fails to resolve the apps' `@/` aliases because their tsconfig doesn't have `paths` set — confirm by reading `apps/mobile/tsconfig.json` and `apps/dashboard/tsconfig*.json`; if `paths` is missing, the sanity test won't rely on it (it's a trivial file), so it'll still pass. Plan to wire real tests should add `paths` to the tsconfig — not in scope here.

## Maintenance notes

- Future test plans for `use-game-store.ts` / `mock-players.ts` should target `apps/mobile/__tests__/` and `apps/dashboard/src/__tests__/`. The vitest config's `include` pattern already catches them.
- When the configure decides to add React Native component tests, switch the mobile config's `environment` to `'jsdom'` or use `@testing-library/react-native` (with `environment: 'node'` per the library docs — confirm at that time).
- A CI workflow (GHA or similar) should run `pnpm -r test:run` across all three apps once this lands. Out of scope for this plan but easy followup.