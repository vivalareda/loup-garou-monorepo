# Plan 017: Broaden `.gitignore` and untrack committed `server.log`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- .gitignore apps/server/server.log`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (no runtime effect; only tracking changes)
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

The root `.gitignore` only covers 3 entries (`node_modules`, `.turbo`, `dist/`). Things currently committed or at risk of being committed:

- `apps/server/server.log` (a ~187 KB runtime log) is git-tracked — `git ls-files` confirms.
- `apps/mobile/.env` and `apps/dashboard/.env` exist locally (currently contain only public backend URLs, no secrets — but no `.gitignore` protection exists if secrets get added later).
- `.DS_Store` files in `apps/` and `apps/server/` are tracked or appear in `ls`.
- `*.tsbuildinfo` (e.g. `apps/server/tsconfig.tsbuildinfo`, `*.tsbuildinfo` for incremental compilation artifacts) is not ignored — some configs emit them.

A broader `.gitignore` is reusable foundation for every future plan.

## Current state

All paths relative to repo root.

- `.gitignore:1-4` — current content:
  ```
  node_modules
  .turbo
  dist/
  ```
- `git ls-files apps/server/server.log` → returns `apps/server/server.log` (confirmed tracked).
- `git ls-files` also reveals `apps/server/src/server/http-server.effect.ts` and `apps/server/src/server/socket-io.effect.ts` are tracked — those are legitimate source files; leave them alone.
- Repo conventions: monorepo with pnpm + turbo + biome. `apps/server` runs `tsx --watch` which writes logs to `apps/server/server.log`. `apps/server/tsconfig.tsbuildinfo` exists (from incremental build). Expo writes to `apps/mobile/.expo/`. Vite writes to `apps/dashboard/node_modules/.vite/` (covered by node_modules). `.DS_Store` is macOS dir metadata.

### Repo conventions to follow

- Plain entries; no negations except a tracked `!.env.example`.
- Group related entries with comments.

## Commands you will need

| Purpose   | Command                                       | Expected on success |
|-----------|-----------------------------------------------|---------------------|
| Confirm   | `git ls-files apps/server/server.log apps/mobile/.env apps/dashboard/.env` | server.log listed; .env files NOT listed (only .env.example is tracked) |
| Untrack   | `git rm --cached apps/server/server.log`      | exit 0              |
| Status    | `git status --short`                            | server.log shows as deleted-from-index, modified-on-disk still present |

## Scope

**In scope**:
- `.gitignore` (root) — add the new patterns.
- `apps/server/server.log` — `git rm --cached` (remove from index, leave on disk).

**Out of scope**:
- Removing any currently-tracked `.DS_Store` or `.tsbuildinfo` (those are local artifacts; can be done in a separate cleanup if needed — this plan's scope is the ignore patterns + the log file the audit flagged as committed).
- Modifying any source code.

## Git workflow

- Branch: `advisor/017-broaden-gitignore`
- Conventional commits — e.g. `chore: broaden .gitignore and untrack server.log`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace `.gitignore` contents

Overwrite `.gitignore` to:

```
# Dependencies
node_modules

# Build outputs
dist/
.turbo
*.tsbuildinfo

# Logs
*.log
apps/server/server.log

# Environment files (keep .env.example tracked)
.env
.env.local
.env.*.local
!.env.example

# OS metadata
.DS_Store
**/.DS_Store

# Expo
apps/mobile/.expo/
apps/mobile/.cache/

# Editors
.idea/
.vscode/
*.swp
*.swo
```

Notes:
- `*.tsbuildinfo` and `*.log` are global; explicit `apps/server/server.log` entry is kept for clarity/defense-in-depth (the audit called it out by name).
- Negation `!.env.example` ensures templates remain tracked.
- Keep `node_modules` and `.turbo` and `dist/` (existing entries) — don't drop coverage.
- Expo's `.expo/` and `.cache/` accumulate build artifacts on dev machines; safe to ignore.
- Editor directories (`.idea/`, `.vscode/`) — common convention; safe to add. `*.swp`/`*.swo` are vim swap files.

**Verify**: `cat .gitignore` shows the new content (or `git diff .gitignore`).

### Step 2: Untrack `apps/server/server.log`

Run `git rm --cached apps/server/server.log`. This removes the file from the git index but leaves it on disk (so the dev server can keep writing logs there).

**Verify**: `git ls-files apps/server/server.log` returns no match. `git status --short` shows `D  apps/server/server.log` followed by `?? apps/server/server.log` (because the working-tree file now matches the new ignore pattern — git skips the untracked flag once the pattern is in place).

### Step 3: Confirm `.env.example` still tracked

Run `git ls-files | rg "\.env\.example"` — the mobile example should still be listed.

**Verify**: `apps/mobile/.env.example` shows in the output.

### Step 4: Sanity check typecheck + tests (unchanged behaviorally)

**Verify**: `pnpm --filter server typecheck` → exit 0. `pnpm --filter server test:run` → 56 pass. (No source change; just safety.)

## Test plan

- No new tests — this is repo-level hygiene. Done criteria grep the result.

## Done criteria

ALL must hold:

- [ ] `git ls-files apps/server/server.log` returns no match (untracked)
- [ ] `git ls-files | rg '\.env\.example'` returns `apps/mobile/.env.example` (still tracked)
- [ ] `grep -n "^\*.log$" .gitignore` returns a match (the global log pattern is in)
- [ ] `grep -n "^.env$" .gitignore` returns a match (the env pattern is in)
- [ ] `grep -n "^.DS_Store$" .gitignore` returns a match (macOS metadata is ignored)
- [ ] `grep -n "!^.env\.example$" .gitignore` returns a match (negation is present)
- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (56 pass)
- [ ] No files outside the in-scope list are modified in a non-ignore way (`git status --short` shows only `.gitignore` modified and `server.log` removed from index)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The repo root `.gitignore` has already been broadened significantly and the audit's "only 3 entries" claim no longer holds — STOP, harmonize with the existing broader version, and refresh the plan if needed.
- `git rm --cached apps/server/server.log` errors because the file is no longer tracked (already removed by an earlier commit) — fine, just report and continue.
- A currently-tracked file ends up matching a new ignore pattern (e.g. a `.tsbuildinfo` is committed) — git will STILL keep it tracked because `.gitignore` doesn't untrack; only blocks new files. Don't `git rm --cached` those in this plan — record them as a follow-up for a later cleanup commit.

## Maintenance notes

- New packages added later (e.g. a `apps/cli/` for game automation) should re-evaluate their own ignore-needs (build dirs, log paths). The global patterns here catch common cases; per-package `.gitignore`s are allowed if needed.
- If the repo moves to a `tsconfig.base.json` strategy (plan 019/related) with `incremental: true` and `tsBuildInfoFile` set, the `*.tsbuildinfo` pattern already covers the configured path.