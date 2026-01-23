# PRD: Debug Segment Mode

## Tasks

### Phase 1: Types & Mock States
- [ ] Create `MockPlayer` type in `@repo/types`
- [ ] Create `MockGameState` type in `@repo/types`
- [ ] Create debug socket event types in `@repo/types`
- [ ] Create `apps/server/src/debug/mock-states.ts` with all segment states

### Phase 2: Server Debug Mode
- [ ] Create `DebugConfig` service (reads `DEBUG_SEGMENT` env var)
- [ ] Add `Game.loadMockState(state: MockGameState)` method
- [ ] Modify `SocketHandlers` to handle `debug:start-segment` event
- [ ] When dashboard connects in debug mode:
  - [ ] Assign socketIds to mock players based on connection order
  - [ ] Emit `debug:ready` with full state
- [ ] On `debug:start-segment`:
  - [ ] Set segment index to target segment
  - [ ] Call `playSegment`

### Phase 3: Dashboard Debug UI
- [ ] Listen for `debug:ready` event
- [ ] Create mock players from received state (with correct roles, socketIds)
- [ ] Show "DEBUG MODE: [SEGMENT]" banner at top
- [ ] Show "Start Segment" button (prominent, centered)
- [ ] On button click → emit `debug:start-segment`
- [ ] After segment starts, normal interaction flow

### Phase 4: Socket ID Mapping
- [ ] Dashboard connects N sockets (one per mock player name)
- [ ] Server assigns socketIds to mock players in order
- [ ] Server updates `MockGameState` with real socketIds
- [ ] Server loads state into Game service with correct socketIds
- [ ] Emit role assignments to each socket

### Phase 5: Polish
- [ ] Add segment dropdown in dashboard (switch without server restart)
- [ ] Add "Reset" button to reload current segment state
- [ ] Clear logging: `[DEBUG] Loaded WEREWOLF state with 6 players`
- [ ] Validate segment name on server start

## Rules

### Segment State Requirements (Checklist)

**CUPID**
- [ ] `segment = 'CUPID'`
- [ ] Cupid player exists with `role = 'CUPID'`
- [ ] All players `isAlive = true`
- [ ] `lovers = null`

**LOVERS**
- [ ] `segment = 'LOVERS'`
- [ ] `lovers = [socketIdA, socketIdB]`
- [ ] Both lovers have `isLover = true` and `loverPartnerId` set
- [ ] `alert:player-is-lover` already sent (or will be sent on segment start)

**WEREWOLF**
- [ ] `segment = 'WEREWOLF'`
- [ ] At least one werewolf with `role = 'WEREWOLF'`
- [ ] Lovers already set (if Cupid/LOVERS ran)
- [ ] Werewolves receive `werewolf:pick-required` on start

**WITCH-HEAL**
- [ ] `segment = 'WITCH-HEAL'`
- [ ] Witch exists with `role = 'WITCH'` and `isAlive = true`
- [ ] `werewolfTarget` set to victim socketId
- [ ] `witchHasHealPotion = true`

**WITCH-POISON**
- [ ] `segment = 'WITCH-POISON'`
- [ ] Witch exists with `role = 'WITCH'` and `isAlive = true`
- [ ] `witchHasPoisonPotion = true`

**DAY_VOTE**
- [ ] `segment = 'DAY_VOTE'`
- [ ] All alive players present in list
- [ ] `pendingDeaths` already processed

**HUNTER**
- [ ] `segment = 'HUNTER'`
- [ ] Hunter exists with `role = 'HUNTER'`
- [ ] Hunter is dead (`isAlive = false`)
- [ ] `hunterMustShoot = true`

```bash
ralphy --add-rule "Debug mode must be opt-in via DEBUG_SEGMENT and no behavior changes when unset"
ralphy --add-rule "Do not auto-start segments; wait for dashboard debug:start-segment"
ralphy --add-rule "Mock players must include role, isAlive, isLover, loverPartnerId, socketId"
ralphy --add-rule "Assign socketIds after dashboard connections, then emit debug:ready"
ralphy --add-rule "Use @repo/types for all debug event/type definitions"
```
