# Plan 019: Align TypeScript versions across the workspace and add a shared `tsconfig.base.json`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- package.json apps/*/package.json packages/*/package.json tsconfig.json apps/*/tsconfig*.json packages/types/tsconfig.json`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: MED (changing TS majors changes inference and lib compat; expect a triage backlog)
- **Depends on**: plan 002 (check-types wired first so we can see the type delta)
- **Category**: migration
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

TypeScript is pinned at **five different versions** across the workspace:

| Package        | TypeScript version |
|----------------|--------------------|
| root           | `5.8.3`            |
| `apps/server`  | `^7.0.2`           |
| `apps/mobile`  | `~6.0.3` (Expo SDK 57 constraint) |
| `apps/dashboard` | `~5.7.2`         |
| `packages/types` | `^5.9.2`         |

Shared `@repo/types` compiled under 5.9.2 may behave differently against consumers
under 7.0.2 (server) and 6.0.3 (mobile). Cross-app edits can pass locally and
fail in another app's typecheck. The root `tsconfig.json` sets only
`strictNullChecks: true` (no `strict`, no shared `moduleResolution`, no `lib`)
— each app invents its own compiler options, so consistency isn't enforced.

## Current state

- `package.json:21` (root) — `"typescript": "5.8.3"` devDep (currently unused by any app — apps have their own).
- `apps/server/package.json:29` — `"typescript": "^7.0.2"` (NOTE: `apps/server/package.json:17` also has a `prepare` script `"effect-tsgo patch"` — this patches the TS LSP for Effect, may constrain TS version choices; see STOP conditions).
- `apps/mobile/package.json:50` — `"typescript": "~6.0.3"`. Expo SDK 57 requires TS ~6.0.3 (per `apps/mobile/app-env.d.ts` / `expo-env.d.ts`).
- `apps/dashboard/package.json:38` — `"typescript": "~5.7.2"`.
- `packages/types/package.json:17` — `"typescript": "^5.9.2"`.
- `tsconfig.json:1-5` (root) — only `{ "compilerOptions": { "strictNullChecks": true } }`.
- `apps/server/tsconfig.json`, `apps/mobile/tsconfig.json`, `apps/dashboard/tsconfig*.json`, `packages/types/tsconfig.json` — each defines its own compiler options.

### Repo conventions to follow

- New shared file `tsconfig.base.json` at root with `strict: true`, `moduleResolution: Bundler` (or `NodeNext` if a package needs it), `lib` defaulting to ES2022+, `esModuleInterop`, `skipLibCheck: true`.
- Each app's `tsconfig.json` `extends: "../../tsconfig.base.json"` and overrides only what's app-specific (e.g. `module` for the server vs `jsx` for mobile).
- Match existing `apps/server/tsconfig.json` style as the exemplar (it's the most evolved — it uses `module: ESNext` + `moduleResolution: Bundler`, paths for `@/` aliases).

## Commands you will need

| Purpose      | Command                                              | Expected on success |
|--------------|------------------------------------------------------|---------------------|
| Install      | `pnpm install`                                       | exit 0              |
| Server check | `pnpm --filter server check-types`                  | exit 0 (or see STOP) |
| Types check  | `pnpm --filter @repo/types check-types`              | exit 0              |
| Mobile check | `pnpm --filter mobile check-types`                  | exit 0 (or see STOP — mobile may have a TS backlog; record and proceed) |
| Dashboard check | `pnpm --filter dashboard check-types`            | exit 0 (or STOP)    |
| Server tests | `pnpm --filter server test:run`                     | 56 pass             |
| Full gate    | `pnpm check-types`                                   | exits 0 OR explicit backtrack list per STOP |

## Scope

**In scope**:
- `tsconfig.base.json` (root) — create.
- `tsconfig.json` (root) — keep but trim to extend base (or delete if redundant).
- `apps/server/tsconfig.json`, `apps/mobile/tsconfig.json`, `apps/dashboard/tsconfig.json` (+ `tsconfig.app.json` / `tsconfig.node.json` if needed per vite conventions), `packages/types/tsconfig.json` — `extends` the base; keep app-specific overrides.
- `package.json` (root) — hoist TypeScript into root devDeps; remove duplicate from apps where safe (mobile MUST keep `~6.0.3` for Expo compat — leave a way to override).
- If a TS version is bumped for alignment: `apps/dashboard/package.json` (`5.7.2` → aligned) and `packages/types/package.json` (`5.9.2` → aligned). Plan targets this alignment:

  **Alignment target: pick the workspace's floor so the shared `@repo/types` types compile under every consumer.** Mobile is constrained by Expo SDK 57 to `~6.0.3`. Therefore choose `~6.0.3` as the workspace TS minor for dashboard + `@repo/types` (lowest common TS that all consumers can use). The server at `^7.0.2` may stay ahead — Effect's `tsgo` LSP supports TS 7. Confirm this split works (see Step 1 — STOP if not).

**Out of scope**:
- Upgrading Expo SDK (already on 57 per `PLAN.md`).
- Upgrading Effect (on 3.21.4 per `PLAN.md` — parking v4 because it's beta-only).
- Splitting `@repo/types` into per-app virtual packages to allow per-app TS majors — out of scope; the alignment target above is sufficient.

## Git workflow

- Branch: `advisor/019-align-typescript`
- Conventional commits — e.g. `chore: align TypeScript across workspace and add shared tsconfig.base.json`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide the TS alignment target (do this BEFORE editing)

Confirm:
1. `apps/server/package.json:17` has `"prepare": "effect-tsgo patch"`. Verify `@effect/tsgo ^0.19.0` (apps/server devDeps) supports TS `~6.0.3` if we downgrade server. **STOP and report** if `@effect/tsgo` requires TS 7 — then alignment to 6 isn't possible for the server; the plan must pick a different strategy (e.g. keep server on 7, align desktop/types on 6, document the gap).
2. Read `apps/mobile/app-env.d.ts` and `apps/mobile/expo-env.d.ts` — these reference TypeScript ambient types shipped by Expo SDK 57; ensure `~6.0.3` honors them.
3. Read `apps/dashboard/tsconfig.app.json` and `apps/dashboard/tsconfig.node.json` — note the `jsx`, `module`, `moduleResolution`, `lib` settings to preserve in the base.

**Decision** (document in your final report):
- Floor TS version (the alignment target for dashboard + `@repo/types` + possibly mobile): `~6.0.3`.
- Server target: keep `^7.0.2` (or fall to `~6.0.3` if `@effect/tsgo ^0.19` supports it — confirm with `pnpm --filter server exec tsgo --help` or by running the patched build; STOP if unclear).

**Verify**: decision recorded.

### Step 2: Create `tsconfig.base.json` at root

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "Bundler",
    "target": "ES2022",
    "lib": ["ES2022"],
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "noEmit": true
  }
}
```

Notes:
- `moduleResolution: Bundler` matches `apps/server/tsconfig.json` (per `PLAN.md` "NodeNext broke every extensionless import — switched to Bundler"). Use `Bundler` for the base; apps that need NodeNext override it.
- `noEmit: true` is the typecheck-only base; build configs (e.g. server's `build` script) override to allow emit.
- `strict: true` is stricter than the current root `strictNullChecks` only — expect a backlog; STOP-condition handling in Step 6.

### Step 3: Trim the root `tsconfig.json`

Replace the root `tsconfig.json` content with a minimal file that extends the base (or delete it if no other consumer references it — confirm via `rg -n 'tsconfig.json' package.json apps/*/package.json packages/*/package.json biome.jsonc`):

```json
{
  "extends": "./tsconfig.base.json"
}
```

**Verify**: `pnpm --filter @repo/types check-types` → exit 0 (types package should be unaffected — it has no settings to override).

### Step 4: Update each app's tsconfig to extend the base

For each `tsconfig*.json` in `apps/server`, `apps/mobile`, `apps/dashboard`, `packages/types`:

- Add `"extends": "../../tsconfig.base.json"` (or the appropriate relative path).
- Remove compiler options now covered by the base (e.g. `strictNullChecks`, `esModuleInterop`, `skipLibCheck`).
- Keep app-specific overrides: server's `module: ESNext` (Bundler needs `module: ESNext` or `Preserve`), mobile's `jsx: react-jsx` and `paths` for `@/`, dashboard's project-reference (`composite: true`, project references) — preserve exactly.

Each tsconfig should end up shorter and inheriting the shared settings.

**Verify**: for each app, `pnpm --filter <pkg> check-types` exits 0 (or records a backlog per STOP).

### Step 5: Align TypeScript versions

- If alignment target is `~6.0.3` for dashboard/types: update `apps/dashboard/package.json` to `"typescript": "~6.0.3"` and `packages/types/package.json` the same. Keep mobile at `~6.0.3`.
- Server: keep `^7.0.2` (per Step 1 confirmation). Document the gap — server on 7, rest on 6.0.3. If server CAN be 6.0.3 (and `@effect/tsgo` supports it), align there too; verify via `pnpm --filter server check-types` then `pnpm --filter server exec node -e "console.log(require('typescript').version)"`.
- Hoist TS into root devDeps: `package.json:21` change from `"typescript": "5.8.3"` to `"typescript": "~6.0.3"` (the chosen floor) and remove from apps where the workspace allows (mobile still pins `~6.0.3` because of Expo — keep it for clarity; pnpm will hoist when versions match).

**Verify**: `pnpm install` → exit 0. Run `pnpm --filter server check-types`, `pnpm --filter mobile check-types`, `pnpm --filter dashboard check-types`, `pnpm --filter @repo/types check-types` — record results in notes.

### Step 6: Triage the type backlog (DO NOT fix in this plan)

If `strict: true` surfaces a set of type errors in any app, **STOP** and report the count + the first few error lines per app. Fixing type errors is a separate plan; this plan only aligns versions and the base config. Document how many errors and which app each belongs to.

If the backlog is small (≤3 errors per app), you MAY optionally fix them inline (they're typically missing `| undefined` on optional fields or `as` casting). Larger backlogs → STOP and plan.

**Verify**: full backlog recorded before continuing.

### Step 7: Full suite

**Verify**:
- `pnpm --filter server test:run` → 56 pass.
- `pnpm check-types` → exits 0 (or documented backlog per STOP).

## Test plan

- No new tests — this is a config alignment. The existing 56 server tests are the behavioral gate; per-app `check-types` runs are the type gate. If a TS-version bump breaks an existing snapshot, see STOP.

## Done criteria

ALL must hold:

- [ ] `ls tsconfig.base.json` exists at root
- [ ] Every app's `tsconfig.json` (and `tsconfig.app.json`/`tsconfig.node.json`) has `"extends"` pointing at the base
- [ ] `grep -rn '"strict": true' tsconfig.base.json` returns a match
- [ ] `pnpm check-types` exits 0 OR a backlog is documented per STOP per app
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] The TS version in each `package.json` is `(server: ^7.0.2 retained OR ~6.0.3 aligned) ; dashboard: ~6.0.3 or kept as-is if alignment tried and blocked; types: matches dashboard; mobile: ~6.0.3 (unchanged)` — record the final pin map in NOTES
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `@effect/tsgo` requires TS 7 specifically — STOP, keep server on 7, align the rest, document the split in your final report.
- An app's TS backlog (introduced by `strict: true`) is >3 errors — STOP and report the count + first few errors per app. The plan does NOT fix type errors; record them for a follow-up plan.
- An existing test breaks because of a TS-version-driven inference change (e.g. the type of `Object.entries(tallies)` changed inference in TS 7 vs 5) — STOP and report; attempt a minor fix only if it's a one-line `as` cast that's clearly equivalent — otherwise STOP for a plan refresh.
- `pnpm install` fails because of TS version resolution conflicts with Expo's transitive deps — STOP and pin mobile firmly at `~6.0.3` (don't allow any version pin elsewhere to force it tighter).

## Maintenance notes

- When the Effect SegmentsManager port lands (parked), its handler TS files will align with the server's TS pin automatically via the shared base.
- If Expo SDK 58+ drops and bumps TS to `~7.0.2`, re-run this plan with a new floor at `~7.0.2` to unify the workspace.
- `noUncheckedIndexedAccess: false` was deliberately not enabled here — enabling it would surface a large backlog; do it as its own plan.
- A GitHub Actions / CI matrix should run `pnpm check-types` across node 18+ with the aligned TS — out of scope here.