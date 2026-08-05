# Plan 020: Fix stale `DOCUMENTATION.md` architecture section (wrong method names, wrong file refs, wrong pattern shape)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- DOCUMENTATION.md apps/server/src/segments/segments-manager.ts apps/server/src/server/server-events.ts apps/server/src/core/game.ts`
> If in-scope file changed, compare "Current state" excerpts against the live
> code before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `4076a78`, 2026-07-10

## Why this matters

`DOCUMENTATION.md` is the repo's main architectural reference, and its
"Established Architecture Pattern" section (lines 36-106) is actively
wrong:

- Describes segments as `switch (SEGMENT_TYPE.CUPID)` — but `SEGMENT_TYPE` doesn't exist anywhere and the live segments are objects with `.action` callbacks (`segments-manager.ts:57-106`).
- References `events.ts` — no such file; the live handler file is `server-events.ts`.
- Calls `this.game.hasAllWerewolvesVoted()` — the live method is `hasAllWerewolvesAgreed()` (`game.ts:348`).
- Says "Keep completion logic in events.ts" (line 99) — file doesn't exist.
- Hardcodes step bodies that don't compile against the actual API.

This is closer to actively misleading than to missing docs — new
contributors following it would write code that doesn't fit. Worse, the doc
prescribes an anti-pattern (`if (gameActions.handleWerewolfVote(...)) {
finishSegment(); }` — returning boolean from GameActions) that the live code
specifically rejected. The section must be rewritten to match reality.

## Current state

All paths relative to repo root.

- `DOCUMENTATION.md:36-106` — the "Segment Architecture Patterns" section. Contains:
  - `case SEGMENT_TYPE.CUPID:` examples that don't exist in the source.
  - `this.game.hasAllWerewolvesVoted()` — wrong; live is `hasAllWerewolvesAgreed()`.
  - `events.ts` references — wrong; live file is `server-events.ts`.
- `apps/server/src/segments/segments-manager.ts:43-107` — the **actual** segment architecture: a `Segment` is `{ type: SegmentType, action: () => void, skip: boolean }`; segments are constructed as objects like `this.cupidSegment = { type: 'CUPID', action: () => this.gameActions.cupidAction(), skip: true };`.
- `apps/server/src/server/server-events.ts` — the actual event layer (not `events.ts`).
- `apps/server/src/server/events-actions.ts:36-42` — the live Werewolf event wiring: `this.game.handleWerewolfVote(...)` + `this.game.hasAllWerewolvesAgreed()` check, then finishSegment.
- `apps/server/src/core/game.ts:348-362` — `hasAllWerewolvesAgreed()` method.

### Repo conventions to follow

- Write doc prose that points at real files using `path/file.ts:line` references — like this plan does.
- Don't invent pseudocode snippets that don't compile; if quoting, quote real code and cite the line.
- Keep the doc's existing heading structure (Sections: Overview / Game Flow Architecture / Segment Architecture Patterns / etc.) — only rewrite the content that's stale.

## Commands you will need

| Purpose   | Command                              | Expected on success |
|-----------|--------------------------------------|---------------------|
| Sanity    | `grep -n "hasAllWerewolvesVoted" DOCUMENTATION.md apps/server/src/` | no matches in live src; matches only in `DOCUMENTATION.md` |

## Scope

**In scope**:
- `DOCUMENTATION.md` — rewrite the "Segment Architecture Patterns" section (lines ~36-106) to match the real segment/event/State architecture. Update any other references to `events.ts`, `SEGMENT_TYPE`, `hasAllWerewolvesVoted` in the rest of the doc.

**Out of scope**:
- Any change to source files; this is a docs-only plan.
- Reorganizing the rest of the doc (Overview, Game Segments, Socket Events, Roles sections are mostly still accurate — small touch-ups only if you find a similar staleness while reading; don't expand the scope).
- Adding new sections (per future feature work).

## Git workflow

- Branch: `advisor/020-fix-documentation-md`
- Conventional commits — e.g. `docs: fix stale Segment Architecture section in DOCUMENTATION.md`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Replace the architecture-pattern section with the real shape

In `DOCUMENTATION.md`, find the "Segment Architecture Patterns" / "Established Architecture Pattern" section (begins around line 36). Rewrite it so it describes:

1. **Segment construction**: a `Segment` is `{ type: SegmentType, action: () => void, skip: boolean }` (cite `packages/types/src/segment.ts:16-20`). `SegmentsManager.initializeSegments()` constructs each segment (cite `apps/server/src/segments/segments-manager.ts:56-106`), e.g.:
   ```ts
   this.werewolfSegment = {
     type: 'WEREWOLF',
     action: () => this.gameActions.werewolfAction(),
     skip: false,
   };
   ```
2. **Segment execution**: `playSegment()` (`segments-manager.ts:165-180`) plays audio then calls the segment's `.action()` callback. The DAY segment now branches into `nightDawnResolution.run()` (cite `apps/server/src/server/night-dawn-resolution.ts`).
3. **Event-driven completion (Werewolf example)**: the live wiring lives in `server-events.ts` (NOT `events.ts`):
   - `events-actions.ts:36-42` — `EventsActions.handleWerewolfVote(socketId, targetPlayer)`:
     ```ts
     handleWerewolfVote(werewolfSid: string, targetSid: string) {
       this.game.handleWerewolfVote(werewolfSid, targetSid);
       if (this.game.hasAllWerewolvesAgreed()) {
         this.game.handleAllWerewolvesAgree();
         this.segmentsManager.finishSegment();
       }
     }
     ```
4. **Anti-pattern to avoid** (the doc's existing anti-pattern block IS still valuable — keep it, but use the real method name): don't return a boolean from `GameActions.handleWerewolfVote`; completion logic stays in `events-actions.ts`. Match the live pattern shown above.

### Step 2: Fix every wrong reference elsewhere in the doc

Search the doc for:

- `events.ts` (without the `server-` prefix) → replace with `server-events.ts`
- `hasAllWerewolvesVoted` → `hasAllWerewolvesAgreed`
- `SEGMENT_TYPE` → remove, or replace with the actual segment object identification (e.g. `segment.type`)

Read through the rest of the file; the "Socket Events" / "Roles" / "Implementation Status" sections may have small staleness too — fix anything you can confirm against the live code, but don't expand scope beyond the clear-stale entries above.

**Verify**: `grep -n "hasAllWerewolvesVoted\|SEGMENT_TYPE\.CASE\|^events\.ts$\|events\.ts:\|this.events\b" DOCUMENTATION.md` returns no matches (or only legitimate occurrences — confirm each).

### Step 3: Quote-check any new snippet

For every code block you rewrite, ensure each method call / field reference resolves in the actual source. Read the cited line before committing that block.

**Verify**: random spot-check — open `apps/server/src/segments/segments-manager.ts:165-180` and `apps/server/src/server/events-actions.ts:36-42` and confirm the snippet in the doc matches the code.

## Test plan

- No automated tests for docs. The done-criteria greps are the gate.

## Done criteria

ALL must hold:

- [ ] `grep -n "hasAllWerewolvesVoted" DOCUMENTATION.md` returns no matches
- [ ] `grep -n "SEGMENT_TYPE\." DOCUMENTATION.md` returns no matches (unless used as illustrative prose; confirm)
- [ ] `grep -n "events\.ts" DOCUMENTATION.md` returns no matches that mean the live file (or every such match refers to the real `server-events.ts` — no bare `events.ts`)
- [ ] `grep -n "Segment Architecture Patterns" DOCUMENTATION.md` returns a match (the section is still there, just fixed)
- [ ] `grep -n "hasAllWerewolvesAgreed" DOCUMENTATION.md` returns at least one match (the living method name is now documented)
- [ ] No source file is modified (`git status` — only DOCUMENTATION.md listed)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The doc has changed substantially from "Current state" (drifted since this plan was written — the section you've been asked to fix doesn't look like the described one).
- While fixing, you discover that the live architecture itself changed (e.g. `playSegment` no longer takes the DAY branch signature I described). Report — the doc can only describe the code as it is; refresh the plan if the live signature is materially different.
- The doc has another section (e.g. "Socket Events") with materially wrong event signatures or payload types — out of scope to fix all of them; fix only the documented ones in the segment-pattern section; note others in your final report so a follow-up plan can cover them.

## Maintenance notes

- When the SegmentsManager Effect port lands (= parked "Next" plan), re-alive this doc's architecture section to describe the Effect-based runner. Future contributors: any change to the segment construction shape or event-routing layer must update this doc in the same PR.
- `apps/server/AGENTS.md` is the tighter Impact-effect-migration doc; consider excerpting a pointer from `DOCUMENTATION.md` to `AGENTS.md` and `plan/001` for the migration pattern — but that's a structural doc decision left to the maintainer.