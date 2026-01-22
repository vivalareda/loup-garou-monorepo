# Loup-Garou Server Architecture Plan

## Overview

This document defines the target architecture for the Effect-based Loup-Garou game server, including service responsibilities, dependencies, and testing requirements.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINT                                │
│                            index.ts                                  │
│                    (Layer composition, runMain)                      │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATION LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│  SocketHandlers          │  GameFlow                                │
│  - Socket event wiring   │  - Game sequence orchestration           │
│  - Error → socket emit   │  - Segment management                    │
│                          │  - Special scenario handling             │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           DOMAIN LAYER                               │
├─────────────────────────────────────────────────────────────────────┤
│  Game                    │  Lobby                                   │
│  - Player state          │  - Pre-game player management            │
│  - Role assignment       │  - Name validation                       │
│  - Lovers                │  - Player limit                          │
│  - Voting (werewolf/day) │                                          │
│  - Death processing      │                                          │
│  - Win conditions        │                                          │
│  - Witch potions         │                                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE LAYER                          │
├─────────────────────────────────────────────────────────────────────┤
│  SocketServer            │  AudioManager       │  HttpServer        │
│  - Socket.IO wrapper     │  - Audio playback   │  - HTTP server     │
│  - Typed events          │  - Segment audio    │  - Lifecycle       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          CONFIGURATION                               │
├─────────────────────────────────────────────────────────────────────┤
│  LobbyConfig             │  Effect Config                           │
│  - maxPlayers            │  - PORT, HOST, ASSETS_PATH               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                          PURE FUNCTIONS                              │
├─────────────────────────────────────────────────────────────────────┤
│  role-assignment.ts      │  vote-tallying.ts   │  win-conditions.ts │
│  - initRolesList()       │  - calculateTally() │  - checkWinner()   │
│  - shuffleArray()        │  - hasAllVoted()    │                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Service Definitions

### 1. LobbyConfig (Configuration Tag)

**Type**: `Context.Tag`

**Purpose**: Configurable lobby settings

**Shape**:
```typescript
interface LobbyConfig {
  maxPlayers: number;
}
```

**Layers**:
- `LobbyConfig.Live` → `{ maxPlayers: 6 }`
- `LobbyConfig.Test` → `{ maxPlayers: 2 }`

**Dependencies**: None

**Tests**: None (pure configuration)

---

### 2. Lobby (Effect.Service)

**Purpose**: Manages pre-game player collection

**Shape**:
```typescript
interface Lobby {
  addPlayer: (name: string, sid: string) => Effect<LobbyPlayer, NameExistsError | LobbyFullError>;
  getAllPlayers: Effect<LobbyPlayer[]>;
  getPlayerCount: Effect<number>;
  isLobbyFull: Effect<boolean>;
  clear: Effect<void>;
}
```

**Dependencies**: `LobbyConfig`

**Tests**:
| Test | Type |
|------|------|
| Adds player successfully | Unit |
| Rejects duplicate names | Unit |
| Rejects when full | Unit |
| Clears all players | Unit |
| Returns correct count | Unit |

---

### 3. Game (Effect.Service)

**Purpose**: Core game state and logic

**Shape**:
```typescript
interface Game {
  // Lifecycle
  startGame: Effect<void>;
  
  // Player queries
  getPlayers: Effect<Player[]>;
  getPlayerBySocketId: (sid: string) => Effect<Player, PlayerNotFoundError>;
  getSpecialRolePlayer: (role: Role) => Effect<Player, SpecialPlayerNotFoundError>;
  getClientPlayerList: Effect<PlayerIdentity[]>;
  getAlivePlayers: Effect<Player[]>;
  getWerewolves: Effect<Player[]>;
  
  // Lovers
  setLovers: (firstSid: string, secondSid: string) => Effect<void, PlayerNotFoundError>;
  getPartner: (sid: string) => Effect<Player | null>;
  isPlayerLover: (sid: string) => Effect<boolean>;
  isAnyLoverHunter: () => Effect<boolean>;
  getLovers: () => Effect<[Player, Player] | null>;
  
  // Werewolf voting
  handleWerewolfVote: (voterSid: string, targetSid: string) => Effect<void, InvalidVoteError>;
  getWerewolfVoteTallies: () => Effect<VoteTallies>;
  hasAllWerewolvesAgreed: () => Effect<boolean>;
  getWerewolfTarget: () => Effect<string | null>;
  clearWerewolfVotes: Effect<void>;
  
  // Day voting
  handleDayVote: (voterSid: string, targetSid: string) => Effect<void>;
  getDayVoteTallies: () => Effect<VoteTallies>;
  hasAllPlayersVoted: () => Effect<boolean>;
  getDayVoteTarget: () => Effect<Player, TieVoteError | NoTargetError>;
  clearDayVotes: Effect<void>;
  
  // Death management
  addPendingDeath: (sid: string, cause: DeathCause) => Effect<void>;
  processPendingDeaths: () => Effect<DeathInfo[]>;
  isInDeathQueue: (sid: string) => Effect<boolean>;
  hunterIsInDeathQueue: () => Effect<boolean>;
  
  // Witch
  canWitchHeal: () => Effect<boolean>;
  canWitchPoison: () => Effect<boolean>;
  witchHeal: () => Effect<void>;
  witchPoison: (targetSid: string) => Effect<void>;
  
  // Win condition
  checkWinner: () => Effect<'villagers' | 'werewolves' | null>;
  
  // Player state
  killPlayer: (sid: string) => Effect<void>;
}
```

**Dependencies**: `Lobby`

**Tests**:
| Test | Type | Priority |
|------|------|----------|
| startGame converts lobby players to game players | Unit | High |
| startGame assigns roles correctly | Unit | High |
| getSpecialRolePlayer returns correct player | Unit | High |
| getSpecialRolePlayer fails when not found | Unit | High |
| setLovers links two players | Unit | High |
| getPartner returns correct partner | Unit | High |
| isAnyLoverHunter detects hunter-lover | Unit | High |
| handleWerewolfVote records vote | Unit | High |
| handleWerewolfVote rejects non-werewolf voter | Unit | High |
| hasAllWerewolvesAgreed true when unanimous | Unit | High |
| hasAllWerewolvesAgreed false when disagreed | Unit | High |
| getDayVoteTarget returns most voted | Unit | High |
| getDayVoteTarget throws on tie | Unit | Medium |
| processPendingDeaths triggers lover suicide | Unit | High |
| processPendingDeaths marks players dead | Unit | High |
| checkWinner returns villagers when no werewolves | Unit | High |
| checkWinner returns werewolves when equal+powerless witch | Unit | High |
| witchHeal removes werewolf victim from death queue | Unit | Medium |
| witchPoison adds target to death queue | Unit | Medium |

---

### 4. AudioManager (Effect.Service)

**Purpose**: Audio playback wrapper

**Shape**:
```typescript
interface AudioManager {
  playIntro: () => Effect<void, AudioPlaybackError>;
  playSegmentStart: (segment: SegmentType) => Effect<void, AudioPlaybackError>;
  playSegmentEnd: (segment: SegmentType) => Effect<void, AudioPlaybackError>;
  playWinnerAudio: (winner: 'villagers' | 'werewolves') => Effect<void, AudioPlaybackError>;
  playHunterDeath: () => Effect<void, AudioPlaybackError>;
  playLoverDeath: () => Effect<void, AudioPlaybackError>;
  playHunterWithLoverDeath: () => Effect<void, AudioPlaybackError>;
  playDeathAnnouncement: (hasDeaths: boolean) => Effect<void, AudioPlaybackError>;
}
```

**Dependencies**: None (self-contained with Config)

**Tests**: None (I/O wrapper, use `.Test` layer for mocking)

**Test Layer**:
```typescript
static Test = Layer.succeed(this, new AudioManager({
  playIntro: () => Effect.void,
  playSegmentStart: () => Effect.void,
  playSegmentEnd: () => Effect.void,
  playWinnerAudio: () => Effect.void,
  playHunterDeath: () => Effect.void,
  playLoverDeath: () => Effect.void,
  playHunterWithLoverDeath: () => Effect.void,
  playDeathAnnouncement: () => Effect.void,
}));

static mockImpl = { /* same as above */ };
```

---

### 5. HttpServer (Context.Tag)

**Purpose**: HTTP server lifecycle

**Shape**: `Server` (Node.js http.Server)

**Dependencies**: None (uses Effect Config)

**Tests**: None (infrastructure)

---

### 6. SocketServer (Effect.Service - Scoped)

**Purpose**: Socket.IO server wrapper

**Shape**: `SocketIOInstance` (typed Socket.IO server)

**Dependencies**: `HttpServer`

**Tests**: None (infrastructure)

**Test Layer**:
```typescript
static Test = Layer.succeed(this, {
  to: (sid) => ({ emit: () => {} }),
  emit: () => {},
  on: () => {},
} as unknown as SocketIOInstance);
```

---

### 7. SocketHandlers (Effect.Service)

**Purpose**: Wires socket events to game logic

**Shape**:
```typescript
interface SocketHandlers {
  setupHandlers: Effect<void>;
}
```

**Internal Methods** (not exposed, just wiring):
- `player:join` → `lobby.addPlayer` + emit player data
- `admin:start-game` → `gameFlow.startGame`
- `cupid:lovers-pick` → `game.setLovers` + `gameFlow.continueAfterCupid`
- `werewolf:player-voted` → `game.handleWerewolfVote` + check agreement
- `witch:healed-player` → `game.witchHeal` + continue
- `witch:poisoned-player` → `game.witchPoison` + continue
- `day:player-voted` → `game.handleDayVote` + check completion
- `hunter:killed-player` → `game.killPlayer` + continue

**Dependencies**: `SocketServer`, `Lobby`, `LobbyConfig`, `Game`, `GameFlow`

**Tests**: None (wiring layer, test via integration if needed)

---

### 8. GameFlow (Effect.Service)

**Purpose**: Orchestrates game phases and segments

**Shape**:
```typescript
interface SegmentState {
  type: SegmentType;
  skip: boolean;
}

interface GameFlow {
  // Lifecycle
  startGame: Effect<void>;
  
  // Segment management
  skipSegment: (type: SegmentType) => Effect<void>;
  
  // Phase runners
  runNightPhase: Effect<void>;
  runDayPhase: Effect<void>;
  
  // Continuation points (called by socket handlers)
  continueAfterCupid: Effect<void>;
  continueAfterLoversReveal: Effect<void>;
  continueAfterWerewolfVote: Effect<void>;
  continueAfterWitchHeal: Effect<void>;
  continueAfterWitchPoison: Effect<void>;
  continueAfterDayVote: Effect<void>;
  continueAfterHunterRevenge: Effect<void>;
  
  // Special scenario checks
  checkPostNightScenarios: () => Effect<SpecialScenario | null>;
  checkPostDayVoteScenarios: () => Effect<SpecialScenario | null>;
}
```

**Dependencies**: `Game`, `Lobby`, `SocketServer`, `AudioManager`

**Tests**:
| Test | Type | Priority |
|------|------|----------|
| startGame assigns roles and notifies players | Integration | Medium |
| skipSegment marks segment as skipped | Unit | Low |
| Cupid segment skipped after first night | Unit | Medium |
| Witch segment skipped when no potions | Unit | Medium |
| Hunter scenario triggered when hunter dies | Unit | Medium |
| Lover suicide triggered when lover dies | Unit | Medium |
| Game ends when winner detected | Unit | Medium |

---

## Pure Functions (Extracted for Testing)

### role-assignment.ts

```typescript
function initRolesList(playerCount: number, rng?: () => number): Role[]
function shuffleArray<T>(array: T[], rng: () => number): T[]
```

**Tests**:
| Test | Priority |
|------|----------|
| 4 players: 1 werewolf, 1 cupid, 2 villagers | High |
| 6 players: 2 werewolves, 1 cupid, 1 witch, 2 villagers | High |
| 8 players: includes hunter | High |
| Deterministic with seeded RNG | High |

### vote-tallying.ts (to be extracted)

```typescript
function calculateTallies(votes: Map<string, string>): Record<string, number>
function hasAllVoted(voters: string[], votes: Map<string, string>): boolean
function getWinningTarget(tallies: Record<string, number>): string | null
function checkForTie(tallies: Record<string, number>): boolean
```

**Tests**:
| Test | Priority |
|------|----------|
| Tallies votes correctly | High |
| Returns null when no agreement | High |
| Detects tie | High |

### win-conditions.ts (to be extracted)

```typescript
function checkWinner(
  aliveWerewolves: number,
  aliveVillagers: number,
  witchHasPotions: boolean
): 'villagers' | 'werewolves' | null
```

**Tests**:
| Test | Priority |
|------|----------|
| Villagers win when 0 werewolves | High |
| Werewolves win when equal and witch powerless | High |
| Game continues when witch has potions | High |

---

## Dependency Graph

```
LobbyConfig ◄─── Lobby ◄─── Game ◄─── GameFlow ◄─── SocketHandlers
                              │           │              │
                              │           ▼              │
                              │     AudioManager         │
                              │           │              │
                              ▼           ▼              ▼
                         HttpServer ◄─ SocketServer ◄────┘
```

**Layer Composition Order**:
```typescript
// Base infrastructure (parallel)
const infraLayer = Layer.mergeAll(
  HttpServer.Live,
  LobbyConfig.Live,
);

// Socket server (needs HttpServer)
const socketLayer = SocketServer.Default;

// Domain services (parallel, but need config)
const domainLayer = Layer.mergeAll(
  Lobby.Default,      // needs LobbyConfig
  AudioManager.Default,
);

// Game (needs Lobby)
const gameLayer = Game.Default;

// Orchestration (needs everything)
const orchestrationLayer = Layer.mergeAll(
  GameFlow.Default,
  SocketHandlers.Default,
);

// Final composition
const mainLayer = orchestrationLayer.pipe(
  Layer.provideMerge(gameLayer),
  Layer.provideMerge(domainLayer),
  Layer.provideMerge(socketLayer),
  Layer.provideMerge(infraLayer),
);
```

---

## Error Types

```typescript
// Lobby errors
class NameExistsError extends Data.TaggedError('NameExists')<{}>
class LobbyFullError extends Data.TaggedError('LobbyFull')<{}>

// Game errors
class PlayerNotFoundError extends Data.TaggedError('PlayerNotFound')<{ socketId: string }>
class SpecialPlayerNotFoundError extends Data.TaggedError('SpecialPlayerNotFound')<{ role: Role }>
class InvalidVoteError extends Data.TaggedError('InvalidVote')<{ reason: string }>
class TieVoteError extends Data.TaggedError('TieVote')<{}>
class NoTargetError extends Data.TaggedError('NoTarget')<{}>

// Audio errors
class AudioPlaybackError extends Data.TaggedError('AudioPlayback')<{ file: string; error: unknown }>
```

---

## Testing Strategy

### Unit Tests (Priority 1)
- Pure functions: `initRolesList`, vote tallying, win conditions
- Game service state management
- Lobby validation rules

### Unit Tests (Priority 2)
- Lovers logic
- Death processing cascade
- Witch potion management

### Integration Tests (Optional)
- Full game flow with mocked I/O
- Special scenario handling (hunter + lover combinations)

### What NOT to Test
- AudioManager (I/O wrapper)
- SocketServer (I/O wrapper)
- HttpServer (I/O wrapper)
- SocketHandlers (pure wiring)
- GameFlow simple sequences (orchestration glue)

---

## Test Layer Strategy

```typescript
// test-utils/layers.ts

// Reusable test layers
export const LobbyTest = Lobby.DefaultWithoutDependencies.pipe(
  Layer.provide(LobbyConfig.Test)
);

export const GameTest = Game.DefaultWithoutDependencies.pipe(
  Layer.provide(LobbyTest)
);

// Capture layers for assertions
export const makeSocketCapture = () => {
  const emissions: Array<{ to: string; event: string; data: unknown }> = [];
  const layer = Layer.succeed(SocketServer, /* mock with capture */);
  return { layer, emissions };
};

export const makeAudioCapture = () => {
  const calls: string[] = [];
  const layer = Layer.succeed(AudioManager, {
    ...AudioManager.mockImpl,
    playIntro: () => Effect.sync(() => calls.push('intro')),
  });
  return { layer, calls };
};
```

---

## Migration Checklist

### Phase 1: Core Game Logic (Current)
- [x] Lobby service
- [x] LobbyConfig
- [x] Game service (basic)
- [x] Role assignment (extracted)
- [x] Lovers (in Game)
- [ ] Werewolf voting (in Game)
- [ ] Day voting (in Game)
- [ ] Death processing (in Game)
- [ ] Win conditions (in Game)
- [ ] Witch potions (in Game)

### Phase 2: Infrastructure
- [x] HttpServer
- [x] SocketServer
- [x] AudioManager (basic)
- [ ] AudioManager (all methods)

### Phase 3: Orchestration
- [ ] GameFlow (segment management)
- [ ] GameFlow (special scenarios)
- [ ] SocketHandlers (event wiring)

### Phase 4: Integration
- [ ] Wire everything in index.ts
- [ ] End-to-end manual testing
- [ ] Dashboard integration testing

---

## File Structure

```
apps/server/src/
├── index.ts                    # Entry point, layer composition
├── core/
│   ├── player.ts              # Player class
│   └── LobbyPlayer.ts         # LobbyPlayer class
├── services/
│   ├── errors.ts              # All error types
│   ├── LobbyConfig.ts         # Config tag
│   ├── Lobby.ts               # Lobby service
│   ├── Game.ts                # Game service (main logic)
│   ├── AudioManager.ts        # Audio service
│   ├── HttpServer.ts          # HTTP server tag
│   ├── SocketServer.ts        # Socket.IO service
│   ├── SocketHandlers.ts      # Event wiring service
│   ├── GameFlow.ts            # Orchestration service
│   ├── role-assignment.ts     # Pure function
│   ├── vote-tallying.ts       # Pure function (to create)
│   ├── win-conditions.ts      # Pure function (to create)
│   └── __tests__/
│       ├── test-utils.ts      # Shared test utilities
│       ├── lobby.test.ts
│       ├── game.test.ts
│       ├── lovers.test.ts
│       ├── role-assignment.test.ts
│       ├── vote-tallying.test.ts
│       ├── win-conditions.test.ts
│       └── death-processing.test.ts
└── types/
    └── segment.ts             # SegmentType, SegmentState
```
