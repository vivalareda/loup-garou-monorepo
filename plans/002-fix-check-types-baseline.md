# Plan 002: Fix `check-types` turbo task so `pnpm check-types` is a real verification gate

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- package.json apps/*/package.json packages/*/package.json turbo.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The root `package.json` advertises `"check-types": "turbo check-types"` and
`turbo.json` declares the task — but **no package in the workspace actually
has a `check-types` script**. `apps/server` has `typecheck` (different name);
`apps/mobile`, `apps/dashboard`, and `packages/types` have neither. Running
`pnpm check-types` prints "No tasks were executed" and exits 0, giving a
false green. This is the verification baseline for every other plan in this
repo — without a working typecheck gate, type regressions slip through
silently and executors cannot trust their own done criteria. Fix it first.

## Current state

All paths relative to repo root. Evidence read directly from the source.

- `package.json:12` — `"check-types": "turbo check-types"` (root script that fans out via turbo).
- `turbo.json:16-18` — declares `"check-types": { "dependsOn": ["^check-types"] }`.
- `apps/server/package.json:16` — `"typecheck": "tsc --noEmit"` (name mismatch).
- `apps/mobile/package.json:5-12` — scripts: `dev, android, ios, prebuild, web, lint` — no typecheck.
- `apps/dashboard/package.json:6-10` — scripts: `dev, build, lint` — no typecheck.
- `packages/types/package.json:5-7` — scripts: `build, lint` — `build` is `tsc` (emits), no `--noEmit` check.

### Repo conventions to follow

- The `apps/server` `typecheck` script uses `tsc --noEmit`. Match that for ts-based packages.
- Each package uses `biome` for lint via `biome check . --write` or `biome lint .`.
- Do NOT add a Husky hook in this plan — that's a separate plan (= AGENTS/CONTRIBUTING scope). Just the scripts.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Install   | `pnpm install`                           | exit 0              |
| Typecheck | `pnpm check-types`                       | exit 0 (may surface a backlog of type errors that need a separate triage plan — see STOP conditions) |
| Server tests | `pnpm --filter server test:run`      | all pass            |

## Scope

**In scope** (the only files you should modify):
- `apps/server/package.json`
- `apps/mobile/package.json`
- `apps/dashboard/package.json`
- `packages/types/package.json`

**Out of scope** (do NOT touch):
- `turbo.json` (task name already correct).
- Root `package.json` (script already correct).
- Any `tsconfig.json` (don't fix type errors in this plan — only wire the command).

## Git workflow

- Branch: `advisor/002-fix-check-types`
- Commit per logical unit; conventional commits — match `git log --oneline -5` style (e.g. `chore: add check-types script to workspace packages`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Rename server's `typecheck` to `check-types` (add alias)

In `apps/server/package.json`, rename the `typecheck` script to `check-types`. Keep a `typecheck` alias too so any existing tooling still works:

```json
"check-types": "tsc --noEmit",
"typecheck": "tsc --noEmit",
```

**Verify**: `pnpm --filter server check-types` → exit 0 (server typecheck should already pass — it's the green baseline).

### Step 2: Add `check-types` to `packages/types`

In `packages/types/package.json` scripts, add:

```json
"check-types": "tsc --noEmit",
```

Keep `build` (`tsc` with emit) intact — consumers need the emitted output.

**Verify**: `pnpm --filter @repo/types check-types` → exit 0.

### Step 3: Add `check-types` to `apps/dashboard`

In `apps/dashboard/package.json` scripts, add:

```json
"check-types": "tsc -b --noEmit",
```

Note: the dashboard uses project references (`tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`), so use `tsc -b --noEmit` (not plain `tsc --noEmit`). If `-b --noEmit` is not supported by the installed TS version, fall back to checking the app config directly: `tsc --noEmit -p tsconfig.app.json`.

**Verify**: `pnpm --filter dashboard check-types` → exit 0.

### Step 4: Add `check-types` to `apps/mobile`

In `apps/mobile/package.json` scripts, add:

```json
"check-types": "tsc --noEmit",
```

Note: the mobile app uses Expo's `app-env.d.ts` and `expo-env.d.ts` for ambient types — ensure those are resolved by the mobile `tsconfig.json` (don't change the tsconfig in this plan).

**Verify**: `pnpm --filter mobile check-types` → see STOP conditions for type-error handling.

### Step 5: Run the whole-workspace gate

Run `pnpm check-types` from the repo root. Turbo should now execute `check-types` in all four packages in dependency order.

**Verify**: `pnpm check-types` → exit 0 OR a known backlog of type errors documented in STOP conditions.

## Test plan

- No new tests — this is a verification-infra change.
- The test it enables: `pnpm --filter server test:run` still passes (no change to test code).
- After this plan, `pnpm check-types` should be a one-command gate for every future plan in this repo.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm --filter server check-types` exits 0
- [ ] `pnpm --filter @repo/types check-types` exits 0
- [ ] `pnpm --filter dashboard check-types` exits 0
- [ ] `pnpm --filter mobile check-types` exits 0 (or a backlog is documented per STOP)
- [ ] `pnpm check-types` exits 0 (or explicit error list per STOP for mobile/dashboard)
- [ ] `pnpm --filter server test:run` still passes
- [ ] No files outside the in-scope list are modified (`git status`)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drifted since this plan was written).
- `apps/mobile` or `apps/dashboard` `check-types` surfaces a non-trivial backlog of type errors (more than 5). **Report the error list and stop** — do NOT attempt to fix type errors in this plan. Fixing the type-backlog is its own plan; this plan only wires the command.
- `tsc -b --noEmit` is not supported by the dashboard's installed TypeScript version — fall back to `tsc --noEmit -p tsconfig.app.json` and report the deviation.

## Maintenance notes

- After this lands, every subsequent plan's "Commands you will need" table can depend on `pnpm check-types` as its typecheck gate.
- If `apps/mobile` or `apps/dashboard` reveal a real type backlog here, a follow-up plan (= type-fix) should land before risky changes in those apps; this plan records the backlog, it doesn't fix it.
- Don't remove the `typecheck` alias on the server — `effect-tsgo` and other tooling may reference it; keep both names until deprecation.