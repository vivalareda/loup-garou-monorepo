# PRD: Mock Scenario Segment Start

## Summary
Provide a way to load a hardcoded game scenario and start a specific segment on demand from the dashboard. This is for fast, repeatable testing of segment behaviors (for example, validating lovers alerts and close events) without playing through the full game flow.

## Implementation Tasks

### Task 1: Scenario Types and Fixtures

**Files:**
- `packages/types/src/mock-scenario.ts`
- `apps/server/src/debug/mock-scenarios.ts`
- `packages/types/src/mock-scenario.test.ts`

Create `MockScenario` type, scenario fixtures array with a lovers scenario, JSDoc comments, and unit tests. Verify type safety and scenario list shape.

- [ ] Create MockScenario type, fixtures array, and tests

**Acceptance:** A hardcoded lovers scenario exists and type-checks ✓

---

### Task 2: Game Reset and Scenario Application

**File: `apps/server/src/services/Game.ts`**

Add `reset()` method to clear game state, `applyScenario(scenario)` method to map scenario slots to players, assign roles, set lovers pair, set alive/dead state, apply votes/deaths, and emit events. Return success/failure status. Emit `debug:error` on validation failure.

- [ ] Add Game.reset() and Game.applyScenario() methods

**Acceptance:** Scenario load produces expected player roles and lovers ✓

---

### Task 3: Segment Manager Service

**Files:**
- `apps/server/src/services/SegmentManager.ts`
- `apps/server/src/services/SegmentManager.test.ts`

Create `SegmentManager` class with `setCurrentSegment(segment)` and `startCurrentSegment()` methods. Implement LOVERS segment action (emit alerts), wire AudioManager, handle transitions, add error handling. Write tests for segment updates and event emission.

- [ ] Create SegmentManager service and tests

**Acceptance:** Invoking `startCurrentSegment()` emits correct lover events ✓

---

### Task 4: Socket Event Wiring

**Files:**
- `packages/types/src/event.ts`
- `apps/server/src/services/SocketHandlers.ts`
- `.env.example` or config

Add `admin:load-scenario` and `admin:start-scenario-segment` event types to Types.cs. Add socket handlers that check debug flag, validate scenario, call Game/SegmentManager, emit `debug:game-state`, handle errors. Add DEBUG_SCENARIOS config flag.

- [ ] Add admin socket events and handlers

**Acceptance:** Dashboard can load and start scenario via socket events ✓

---

### Task 5: Dashboard Controls and State View

**Files:**
- `apps/dashboard/src/components/MockScenarioPanel.tsx` (new)
- `apps/dashboard/src/components/admin-controls.tsx`
- `apps/dashboard/src/hooks/useDebugGameState.ts` (if needed)

Create scenario selector dropdown, Load/Start Segment buttons, and display state (segment type, player list with roles, lovers pair, alive/dead status, votes, pending deaths). Handle socket emissions, loading states, errors. Wire to admin-controls and useDebugGameState hook.

- [ ] Create MockScenarioPanel component and controls

**Acceptance:** Dashboard shows scenario data and can start segment ✓

---

### Task 6: Testing

**Server Tests**

**Files:**
- `apps/server/src/services/Game.test.ts`
- `apps/server/src/services/SegmentManager.test.ts`
- `apps/server/src/services/SocketHandlers.test.ts`

Unit tests: Game.applyScenario() slot mapping, scenario validation, role assignment, lovers pair assignment, SegmentManager.startCurrentSegment() lover events. Integration tests: socket handlers scenario load/start flows, debug flag gating.

**Dashboard Tests** (optional)

**File:** `apps/dashboard/src/components/MockScenarioPanel.test.ts`

Component rendering, socket event emissions, state display accuracy.

- [ ] Write server and dashboard tests

**Acceptance:** All tests pass and cover new flows ✓

---

## Final Acceptance Criteria
- [ ] Tester can load a lovers scenario and see state in dashboard
- [ ] Pressing "Start Segment" triggers lovers alerts on connected clients
- [ ] Scenarios are gated behind debug flag
- [ ] Normal gameplay is unaffected when scenarios not used
- [ ] Server and dashboard remain type-safe
- [ ] All tests pass
- [ ] Code follows project Effect guidelines (consult `effect-solutions`)
- [ ] No breaking changes to existing socket event contracts

---

## Data Model Reference

### MockScenario Type
```typescript
{
  id: string;
  label: string;
  segment: SegmentType;
  players: Array<{ role: Role; isAlive?: boolean }>;
  lovers?: [number, number]; // slot indexes
  werewolfVotes?: Record<number, number>; // voter slot -> target slot
  dayVotes?: Record<number, number>;
  pendingDeaths?: Array<{ slot: number; cause: DeathCause }>;
}
