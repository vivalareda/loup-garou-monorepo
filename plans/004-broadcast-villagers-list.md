# Plan 004: Broadcast `lobby:villagers-list` to all sockets so the werewolf has targets to pick

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat 4076a78..HEAD -- apps/server/src/server/server-events.ts`
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

When the 6th player joins and the game starts, `server-events.ts:46` emits
`lobby:villagers-list` **only to the joining socket**. The other 5 players
never receive the list. On the mobile client, `villagersList` in the Zustand
store stays empty (`use-game-store.ts:135-137`); the werewolf modal — which
maps over `villagersList` to build the kill-target list
(`game-interface.tsx:174`) — renders **zero targets**, making the werewolf
night action unusable for 5 of 6 real players. The game cannot progress past
the first night on real clients. Same bug exists in `admin:start-game`.

## Current state

All paths relative to repo root.

- `apps/server/src/server/server-events.ts:42-48` — `player:join` handler:
  ```ts
  if (this.game.getPlayerList().size >= MAX_PLAYERCOUNT) {
    this.game.assignRoles();
    this.game.alertPlayersOfRoles();
    socket.emit('lobby:villagers-list', this.game.getVillagersList());
    this.segmentsManager.startGame();
  }
  ```
  `socket.emit` sends only to the 6th joiner. `this.io.emit(...)` would broadcast to all connected sockets.

- `apps/server/src/server/server-events.ts:56-62` — `admin:start-game` handler has the same single-socket pattern: `socket.emit('lobby:villagers-list', ...)`.

- Mobile consumer: `apps/mobile/hooks/use-game-store.ts:135-137` — `socket.on('lobby:villagers-list', (villagers) => { set({ villagersList: villagers }); })`. Only sockets that receive the event populate the list.

- Mobile modal: `apps/mobile/app/(game)/game-interface.tsx:174` — `data: villagersList.map((p) => p.socketId)`. Empty list → empty target picker.

### Repo conventions to follow

- The server uses `this.io.emit(...)` elsewhere for broadcasts (e.g. `server-events.ts:141`, `game.ts:512`, `game-actions.ts:110`). Match that.
- Note: `getVillagersList()` returns `PlayerListItem[]` for non-werewolves — the list name says "villagers" but it includes special-role villagers (Cupid, Witch, Hunter, Seer). Leave the semantics.

## Commands you will need

| Purpose   | Command                                  | Expected on success |
|-----------|------------------------------------------|---------------------|
| Typecheck | `pnpm --filter server typecheck`        | exit 0, no errors   |
| Tests     | `pnpm --filter server test:run`         | all pass            |

## Scope

**In scope**:
- `apps/server/src/server/server-events.ts` — change both `socket.emit('lobby:villagers-list', ...)` calls to `this.io.emit('lobby:villagers-list', ...)`.

**Out of scope**:
- The Effect variant (`event-handlers.effect.ts`) — the plan scope is the active code path; the Effect handlers are dead code (separate plan).
- Any change to `getVillagersList()`'s return shape or content.
- Mobile or dashboard code — they already handle the event correctly once they receive it.

## Git workflow

- Branch: `advisor/004-broadcast-villagers-list`
- Conventional commits — e.g. `fix: broadcast villagers list to all players on game start`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Broadcast on auto-start (player:join)

In `apps/server/src/server/server-events.ts`, inside the `player:join` handler's `if (this.game.getPlayerList().size >= MAX_PLAYERCOUNT)` block, change:

```ts
socket.emit('lobby:villagers-list', this.game.getVillagersList());
```

to:

```ts
this.io.emit('lobby:villagers-list', this.game.getVillagersList());
```

Leave `alertPlayersOfRoles()` and `segmentsManager.startGame()` untouched — they're already correct (`alertPlayersOfRoles` already iterates and emits per socket at `game.ts:156-163`; `startGame` runs server-side).

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 2: Broadcast on admin:start-game

In the `admin:start-game` handler at `server-events.ts:56-62`, change `socket.emit('lobby:villagers-list', ...)` to `this.io.emit('lobby:villagers-list', ...)`.

**Verify**: `pnpm --filter server typecheck` → exit 0.

### Step 3: Confirm no other `lobby:villagers-list` sends exist

Search the server for any other `emit('lobby:villagers-list'` sites: `grep -rn "lobby:villagers-list" apps/server/src/`. You should find the consumers (mobile/dashboard) and now-broadcasting server senders. Confirm both senders are now `this.io.emit`.

**Verify**: `grep -n "socket.emit('lobby:villagers-list'" apps/server/src/server/server-events.ts` returns no matches.

### Step 4: Full suite

**Verify**: `pnpm --filter server test:run` → all 56 tests pass (no behavioral test depends on the single-socket send; if one unexpectedly fails, see STOP conditions).

## Test plan

- No new tests in this plan — the bug is a missing broadcast, hard to test without an integration harness, and the GAMEEVENTS wiring suite is a separate plan (= 008 integrate). The verification here is type-check + existing test green.
- If a fast-follow integration test plan exists when this lands, the regression test belongs there.

## Done criteria

ALL must hold:

- [ ] `pnpm --filter server typecheck` exits 0
- [ ] `pnpm --filter server test:run` exits 0 (all 56 pass)
- [ ] `grep -rn "socket.emit('lobby:villagers-list'" apps/server/src/` returns no matches
- [ ] `grep -n "this.io.emit('lobby:villagers-list'" apps/server/src/server/server-events.ts` returns exactly two matches (one per handler)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at `server-events.ts:42-62` doesn't match the excerpts in "Current state".
- An existing server test fails specifically because of the broadcast change (e.g. a mock `io` asserts the villagers list was only sent to one socket). Report the test name and its assertion — the test expectation itself is likely the bug and should be updated, but that's a judgment call you should not make unprompted.

## Maintenance notes

- The dead Effect handler (`event-handlers.effect.ts`) has the same bug at its `handlePlayerJoin`; if/when the Effect path gets wired, that handler needs the parallel fix (`broadcastFrom` instead of `socket.emit`).
- The mobile `use-game-events.ts` already routes `lobby:villagers-list` — no client change needed once the server broadcasts.

## Maintenance notes (cont.)

- If the game later supports multi-room (currently a single global game per server instance), this broadcast becomes `this.io.to(roomName).emit(...)`; today the global `this.io` is correct because only one game runs at a time.