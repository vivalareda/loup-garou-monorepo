# Plan 021: Fix README references to nonexistent scripts (`pnpm dev:dashboard`, `pnpm clean`, `pnpm dev:web` mismatch)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- README.md package.json`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`README.md` instructs contributors to run `pnpm dev:dashboard` (line 69) and
`pnpm clean` (line 84) — neither script exists in `package.json`. The root
package defines only `dev, lint, build, check-types, dev:mobile, dev:web,
dev:server`. There's a `dev:web` but no `web` app (the web-facing app is
`dashboard`). Following the README verbatim fails.

## Current state

- `README.md:69` — `pnpm dev:dashboard # Testing dashboard`
- `README.md:84` — `pnpm clean - Clean build outputs and node_modules`
- `package.json:8-16` — scripts: `dev, lint, build, check-types, dev:mobile, dev:web, dev:server`. No `dev:dashboard`, no `clean`. The `dev:web` reference says "web" but the app is `dashboard`.

### Repo conventions to follow

- Match `README.md`'s existing sections and tone.
- Don't invent new build scripts — the README must describe what exists. If a `clean` script is genuinely missing, that's a feature request (= separate plan); this plan only fixes the README to match reality.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Sanity    | `pnpm run 2>/dev/null | head -20`    | lists the actual scripts |
| Verify    | `pnpm -F dashboard dev --help` (optional) | works |

## Scope

**In scope**:
- `README.md` — fix the "Available Scripts" section + the individual development command block to match `package.json`.

**Out of scope**:
- Adding new scripts to `package.json`. (The README fix is to remove stale references, not to keep them by inventing scripts.)
- Rewriting the entire README. Touch only the stale blocks.

## Git workflow

- Branch: `advisor/021-fix-readme-scripts`
- Conventional commits — e.g. `docs: fix README script references`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory actual scripts

Run `pnpm run` (no script name) to list root scripts; record the canon.

Confirm:
- `dev:mobile`, `dev:server` exist.
- `dev:web` exists (but no web app — this should be renamed or removed).
- `dev:dashboard` does NOT exist.
- `clean` does NOT exist.

### Step 2: Decide on `dev:web`

The root has `dev:web` but no `web` app — the dashboard IS the web app here. Prefer renaming `dev:web` → `dev:dashboard` in `package.json` AND `turbo.json` OR removing `dev:web` and updating the README to use `pnpm -F dashboard dev`. Pick the simpler path: **rename to `dev:dashboard`** (matches README intent, requires `turbo.json` filter alias to work).

In `package.json`:
- Rename `"dev:web": "turbo -F web dev"` → `"dev:dashboard": "turbo -F dashboard dev"` (~line 14).

In `turbo.json`:
- The `dev` task didn't reference `web` directly — only the package filter did. No `turbo.json` change needed unless there's an explicit `web` reference — grep and confirm.

**Verify**: `pnpm dev:dashboard` runs the dashboard dev server (or at least turbo recognizes the filter) — `pnpm run | rg dev:dashboard` lists it.

### Step 3: Update README "Available Scripts" and "Development" sections

In `README.md`:

- The "Development" block (around lines 65-70) that lists `pnpm dev:server`, `pnpm dev:mobile`, `pnpm dev:dashboard` — ensure `dev:dashboard` now exists (after Step 2). If you chose to use `pnpm -F dashboard dev` instead, update the README to that.
- The "Available Scripts" block (around lines 80-85): remove `pnpm clean - Clean build outputs and node_modules`. If a `clean` script is genuinely desired, add a one-line note: "Pending: a `clean` script is not currently defined; manually remove `dist/`, `.turbo/`, `node_modules/` as needed." Better: just remove the bullet entirely.
- Replace `pnpm dev:web` references with `pnpm dev:dashboard`.

**Verify**: `grep -n "dev:dashboard\|dev:web\|pnpm clean" README.md` shows no stale matches.

### Step 4: Confirm anything else in README still matches reality

Quickly re-read the "Prerequisites", "Installation", "Environment Setup" sections — fix anything else you can confirm against the current code (e.g. pnpm version, Node version, etc.). If any bigger rewrite is needed (docs of unimplemented features), STOP and report — it's out of scope.

## Test plan

- No automated tests for a README fix. The done criteria greps + a `pnpm run` dry-run are the gate.

## Done criteria

ALL must hold:

- [ ] `pnpm run | rg 'dev:dashboard'` returns a match (script now exists)
- [ ] `grep -n "pnpm dev:dashboard" README.md` returns at least one match
- [ ] `grep -n "pnpm clean" README.md` returns no matches (or matches with an explicit "not available" note)
- [ ] `grep -rn "dev:web" README.md package.json turbo.json` returns no matches
- [ ] No source files modified outside scope (only README.md, package.json, and possibly turbo.json)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- A secret or undocumented assumption blocks the rename of `dev:web` → `dev:dashboard` (e.g. some external CI references `dev:web`).
- You discover the README has bigger structural issues (= wrong game-flow docs) — STOP and report; plan 021 is README-scripts-only; add a follow-up plan if needed.

## Maintenance notes

- When a CI workflow is added, it should reference the real script names — `dev:server`, `dev:mobile`, `dev:dashboard`. Update that workflow in the same commit as any script rename.
- If a `clean` script gets added later, update README to reference it; in the meantime, this plan removes a fake entry that was silently failing.