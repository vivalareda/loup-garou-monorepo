# Testing Strategy PRD - Loup-Garou Server

## Overview

This document outlines what should be tested in the Loup-Garou game server, prioritized by value and complexity.

---

## Priority 1: High Value, Pure Logic (MUST TEST)

These are pure functions with no I/O dependencies. Easy to test, high value.

### 1.1 Role Assignment Logic (`initRolesList`)

**Location**: `apps/server/src/services/Game.ts` (lines 7-47)

**What to test**:
| Player Count | Expected Roles |
|--------------|----------------|
| 4 players | 1 Werewolf, 1 Cupid, 2 Villagers |
| 5 players | 1 Werewolf, 1 Cupid, 3 Villagers |
| 6 players | 2 Werewolves, 1 Cupid, 1 Witch, 2 Villagers |
| 8 players | 2 Werewolves, 1 Cupid, 1 Witch, 1 Hunter, 3 Villagers |
| 10 players | 3 Werewolves, 1 Cupid, 1 Witch, 1 Hunter, 4 Villagers |

**Test file**: `apps/server/src/services/__tests__/role-assignment.test.ts`

```typescript
describe('initRolesList', () => {
  it('assigns 1 werewolf for 4 players');
  it('assigns 2 werewolves for 6 players');
  it('includes witch when 6+ players');
  it('includes hunter when 8+ players');
  it('fills remaining slots with villagers');
  it('returns shuffled array (non-deterministic order)');
});
```

**Recommendation**: Extract `initRolesList` as a pure function (not inside service) for easier testing.

---

### 1.2 Vote Tallying Logic

**Location**: Old code in `apps/server.bk/src/core/game.ts`

**What to test**:

**Werewolf voting**:
- `calculateWerewolfVoteTallies()` - counts votes correctly
- `hasAllWerewolvesAgreed()` - true only when all werewolves vote same target
- `getWerewolfTarget()` - returns agreed target or null

**Day voting**:
- `calculateDayVoteTallies()` - counts votes correctly
- `getDayVoteTarget()` - returns player with most votes
- `getDayVoteTarget()` - throws on tie (current behavior)

```typescript
describe('Vote Tallying', () => {
  describe('Werewolf Votes', () => {
    it('tallies votes correctly');
    it('returns null when werewolves disagree');
    it('returns target when all agree');
    it('handles vote changes correctly');
  });

  describe('Day Votes', () => {
    it('tallies votes correctly');
    it('returns player with most votes');
    it('throws error on tie');
    it('handles abstentions (if implemented)');
  });
});
```

---

### 1.3 Win Condition Logic

**Location**: Old code `apps/server.bk/src/core/game.ts` (`checkIfWinner`)

**What to test**:
| Scenario | Expected Winner |
|----------|-----------------|
| 0 werewolves alive | Villagers win |
| Equal werewolves and villagers (1v1), witch has potion | Game continues |
| Equal werewolves and villagers (1v1), witch no potions | Werewolves win |
| More werewolves than villagers | Werewolves win |

```typescript
describe('Win Conditions', () => {
  it('villagers win when all werewolves dead');
  it('werewolves win when equal numbers and witch powerless');
  it('game continues when witch has potions in 1v1');
  it('werewolves win when they outnumber villagers');
});
```

---

## Priority 2: Medium Value, Service Logic (SHOULD TEST)

### 2.1 Lobby Service

**Location**: `apps/server/src/services/Lobby.ts`

**Already tested** (partially):
- ✅ Add player
- ✅ Reject duplicate names
- ✅ Reject when lobby full (needs fix with `DefaultWithoutDependencies`)

**Additional tests needed**:
```typescript
describe('Lobby Service', () => {
  it('clears all players');
  it('returns correct player count');
  it('getAllPlayers returns all players');
});
```

---

### 2.2 Game Service - State Management

**Location**: `apps/server/src/services/Game.ts`

**What to test**:
```typescript
describe('Game Service', () => {
  describe('startGame', () => {
    it('converts lobby players to game players');
    it('assigns roles to all players');
    it('sets special role players correctly');
  });

  describe('getSpecialRolePlayer', () => {
    it('returns cupid when cupid exists');
    it('returns witch when witch exists');
    it('fails with SpecialPlayerNotFoundError when role not assigned');
  });

  describe('getPlayerBySocketId', () => {
    it('returns player when found');
    it('fails with PlayerNotFoundError when not found');
  });
});
```

---

### 2.3 Lover Logic (To Be Implemented)

**What to test**:
```typescript
describe('Lovers', () => {
  it('setLovers marks two players as lovers');
  it('getPartner returns the other lover');
  it('isPlayerLover returns true for lovers');
  it('isPlayerLover returns false for non-lovers');
  it('isAnyOfLoverHunter returns true if hunter is a lover');
});
```

---

### 2.4 Death Processing (To Be Implemented)

**What to test**:
```typescript
describe('Death Processing', () => {
  it('kills player and marks as dead');
  it('triggers partner suicide when lover dies');
  it('does not double-kill if partner already dead');
  it('handles hunter death (enables revenge)');
  it('disables witch powers when witch dies');
});
```

---

## Priority 3: Lower Value, Orchestration (NICE TO HAVE)

### 3.1 GameFlow - Only Test Complex Branching

**Skip testing**: Simple sequences (audio → socket → audio)

**Do test**: Special scenario branching

```typescript
describe('GameFlow - Special Scenarios', () => {
  it('skips cupid segment after first night');
  it('skips witch segment when witch has no potions');
  it('triggers hunter phase when hunter dies at night');
  it('handles hunter-is-lover scenario');
});
```

---

## Priority 4: Integration Tests (OPTIONAL)

### 4.1 Full Game Flow

End-to-end test with mocked Socket.IO:
```typescript
describe('Full Game Integration', () => {
  it('completes a game where villagers win');
  it('completes a game where werewolves win');
  it('handles hunter revenge correctly');
  it('handles lover suicide chain correctly');
});
```

---

## What NOT to Test

| Component | Reason |
|-----------|--------|
| AudioManager | Just wraps `sound-play` library |
| SocketServer | Just wraps Socket.IO |
| HttpServer | Just wraps Node HTTP |
| GameFlow sequences | Pure orchestration, no logic |
| Socket event wiring | Implementation detail |

---

## Test Layer Strategy

### Reusable Test Layers

```typescript
// test-utils/layers.ts

// Silent mocks for dependencies
export const SocketServerTest = Layer.succeed(SocketServer, ...);
export const AudioManagerTest = Layer.succeed(AudioManager, ...);

// Real services with test config
export const LobbyTest = Lobby.DefaultWithoutDependencies.pipe(
  Layer.provide(LobbyConfig.Test)
);

export const GameTest = Game.DefaultWithoutDependencies.pipe(
  Layer.provide(LobbyTest)
);
```

### Capture Layers for Assertions

```typescript
// test-utils/captures.ts

export const makeSocketCapture = () => {
  const emissions: Array<{to: string, event: string, data: unknown}> = [];
  const layer = Layer.succeed(SocketServer, ...);
  return { layer, emissions };
};

export const makeAudioCapture = () => {
  const calls: string[] = [];
  const layer = Layer.succeed(AudioManager, ...);
  return { layer, calls };
};
```

---

## Recommended Test File Structure

```
apps/server/src/
├── services/
│   ├── __tests__/
│   │   ├── lobby.test.ts          ✅ Exists (needs fixes)
│   │   ├── role-assignment.test.ts   📝 Create
│   │   ├── game-state.test.ts        📝 Create
│   │   ├── vote-tallying.test.ts     📝 Create
│   │   ├── win-conditions.test.ts    📝 Create
│   │   ├── lovers.test.ts            📝 Create (when implemented)
│   │   └── death-processing.test.ts  📝 Create (when implemented)
│   └── test-utils/
│       ├── layers.ts              📝 Create
│       └── captures.ts            📝 Create
```

---

## Implementation Order

1. **Fix existing lobby test** - Use `DefaultWithoutDependencies` pattern
2. **Extract and test `initRolesList`** - Pure function, easy win
3. **Test vote tallying** - Critical game logic
4. **Test win conditions** - Critical game logic
5. **Test Game service state** - After migrating more logic from old code
6. **Test lovers/death** - When implemented
7. **Integration tests** - Last, optional

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Role assignment logic | 100% coverage |
| Vote tallying logic | 100% coverage |
| Win condition logic | 100% coverage |
| Lobby service | 90% coverage |
| Game service state | 80% coverage |
| GameFlow | 0% (skip) |
| Audio/Socket wrappers | 0% (skip) |
