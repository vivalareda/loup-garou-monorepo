# Loup-Garou Server

An Effect-based TypeScript server for the Loup-Garou (Werewolf) multiplayer game.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Service Dependency Graph](#service-dependency-graph)
- [Layer Composition Order](#layer-composition-order)
- [Running Tests](#running-tests)
- [Adding New Services](#adding-new-services)

---

## Architecture Overview

The server follows a layered architecture built with the Effect library, separating concerns into distinct layers:

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

### Layers Explained

- **Entry Point**: Composes all layers and starts the application
- **Orchestration Layer**: Coordinates game flow and handles socket event wiring
- **Domain Layer**: Contains core game logic and state management
- **Infrastructure Layer**: Provides external service integrations (sockets, audio, HTTP)
- **Configuration**: Stores configuration values for different environments
- **Pure Functions**: Stateless utility functions for easy testing

---

## Service Dependency Graph

```
LobbyConfig ◄─── Lobby ◄─── Game ◄─── GameFlow ◄─── SocketHandlers
|                               │           │              │
|                               │           ▼              │
|                               │     AudioManager         │
|                               │           │              │
|                               ▼           ▼              ▼
                          HttpServer ◄─ SocketServer ◄────┘
```

### Service Descriptions

#### LobbyConfig
- **Purpose**: Configuration tag for lobby settings
- **Dependencies**: None
- **Methods**: `maxPlayers` property

#### Lobby
- **Purpose**: Manages pre-game player collection
- **Dependencies**: `LobbyConfig`
- **Methods**:
  - `addPlayer(name, sid)` - Add player to lobby
  - `getAllPlayers()` - Get all lobby players
  - `getPlayerCount()` - Get current player count
  - `isLobbyFull()` - Check if lobby is at capacity
  - `clear()` - Remove all players

#### Game
- **Purpose**: Core game state and logic
- **Dependencies**: `Lobby`
- **Methods**: (see JSDoc in `src/services/Game.ts`)

#### GameFlow
- **Purpose**: Orchestrates game phases and segments
- **Dependencies**: `Game`, `Lobby`, `SocketServer`, `AudioManager`
- **Methods**: (see JSDoc in `src/services/GameFlow.ts`)

#### AudioManager
- **Purpose**: Audio playback wrapper
- **Dependencies**: None
- **Methods**: `playIntro()`, `playSegmentStart()`, `playSegmentEnd()`, etc.

#### HttpServer
- **Purpose**: HTTP server lifecycle
- **Dependencies**: None
- **Methods**: Node.js `http.Server` instance

#### SocketServer
- **Purpose**: Socket.IO server wrapper
- **Dependencies**: `HttpServer`
- **Methods**: Socket.IO server instance with typed events

#### SocketHandlers
- **Purpose**: Wires socket events to game logic
- **Dependencies**: `SocketServer`, `Lobby`, `LobbyConfig`, `Game`, `GameFlow`
- **Methods**: `setupHandlers()` - Configures all socket event handlers

---

## Layer Composition Order

The application layers are composed in a specific order to satisfy dependencies:

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

### Composition Rules

1. **Infrastructure layers** (bottom) - no dependencies, composed first
2. **Domain layers** (middle) - depend on infrastructure
3. **Orchestration layers** (top) - depend on domain and infrastructure
4. Layers at the same level can be composed in parallel using `Layer.mergeAll`
5. Each layer must be provided with its dependencies using `Layer.provideMerge`

---

## Running Tests

### Prerequisites

Ensure all dependencies are installed:
```bash
pnpm install
```

### Test Commands

Run tests in watch mode:
```bash
npm run test
```

Run tests once:
```bash
npm run test:run
```

Run tests with coverage:
```bash
npm run test:run -- --coverage
```

### Test Structure

Tests are located in `apps/server/src/services/__tests__/`:
- `lobby.test.ts` - Lobby service tests
- `game.test.ts` - Game service tests
- `lovers.test.ts` - Lovers logic tests
- `role-assignment.test.ts` - Role assignment pure function tests
- `vote-tallying.test.ts` - Vote tallying pure function tests
- `win-conditions.test.ts` - Win conditions pure function tests
- `death-processing.test.ts` - Death processing tests

### Test Utilities

Shared test utilities are available in `test-utils.ts`:
- `LobbyTest` - Test layer for Lobby service
- `GameTest` - Test layer for Game service
- `makeSocketCapture()` - Creates a mock SocketServer that captures emissions
- `makeAudioCapture()` - Creates a mock AudioManager that captures calls

---

## Adding New Services

### Step 1: Define the Service

Create a new service file in `src/services/` using the Effect.Service pattern:

```typescript
import { Effect } from 'effect';

// Define the service interface
interface MyService {
  myMethod: (param: string) => Effect<string, Error>;
}

// Create the service class
export class MyService extends Effect.Service<MyService>()('@app/MyService', {
  effect: Effect.gen(function* () {
    // Initialize service state
    const state = new Map<string, string>();

    return {
      myMethod: (param: string) =>
        Effect.gen(function* () {
          // Implementation
          return `Result: ${param}`;
        }),
    };
  }),
  dependencies: [
    // List service dependencies here
    // Dependency.Default,
  ],
}) {}
```

### Step 2: Add JSDoc Documentation

Add comprehensive JSDoc comments to all public methods:

```typescript
return {
  /**
   * Does something with a parameter.
   * @param param - The parameter to process.
   * @returns Effect containing the result string.
   * @throws Error - If something goes wrong.
   * @dependencies Depends on other services.
   */
  myMethod: (param: string) =>
    Effect.gen(function* () {
      // Implementation
      return `Result: ${param}`;
    }),
};
```

### Step 3: Add Pure Functions (if applicable)

Extract pure logic to separate files for easier testing:

```typescript
// src/services/my-pure-functions.ts
export function myPureFunction(input: string): string {
  return `Processed: ${input}`;
}
```

### Step 4: Create Tests

Create test file in `src/services/__tests__/`:

```typescript
import { describe, it, expect } from 'vitest';
import { Effect } from 'effect';
import { MyService } from '../MyService.js';

describe('MyService', () => {
  it('should process input correctly', async () => {
    const result = await Effect.runPromise(
      MyService.myMethod('test')
    );
    expect(result).toBe('Result: test');
  });
});
```

### Step 5: Add Test Layer

Create a test layer for mocking dependencies (if needed):

```typescript
// In src/services/__tests__/test-utils.ts
import { Layer } from 'effect';

export const MyServiceTest = MyService.DefaultWithoutDependencies.pipe(
  Layer.provide(/* mock dependencies */)
);

// Or provide a mock implementation
MyService.Test = Layer.succeed(this, {
  myMethod: () => Effect.succeed('mock result'),
});
```

### Step 6: Update Layer Composition

Add the new service to the layer composition in `src/index.ts`:

```typescript
// Determine which layer level the service belongs to
const domainLayer = Layer.mergeAll(
  Lobby.Default,
  AudioManager.Default,
  MyService.Default, // Add here if it's a domain service
);

// Or orchestration layer
const orchestrationLayer = Layer.mergeAll(
  GameFlow.Default,
  SocketHandlers.Default,
  MyService.Default, // Add here if it's an orchestration service
);
```

### Step 7: Update Documentation

- Add service to the architecture diagram in this README
- Add service to the dependency graph
- Document service in `/extra/ARCHITECTURE.md`
- Add test cases to the architecture document

### Step 8: Run Tests and Linting

Verify everything works:
```bash
npm run test:run
npm run lint
npm run lint:fix
```

---

## Error Types

The server uses Effect's TaggedError pattern for error handling:

### Lobby Errors
- `NameExistsError` - Player name already taken
- `LobbyFullError` - Lobby has reached maximum capacity

### Game Errors
- `PlayerNotFoundError` - Player not found by socket ID
- `SpecialPlayerNotFoundError` - Special role player not found
- `InvalidVoteError` - Vote validation failed
- `TieVoteError` - Voting resulted in a tie
- `NoTargetError` - No valid vote target

### Audio Errors
- `AudioPlaybackError` - Audio file playback failed

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
│   ├── vote-tallying.ts       # Pure function
│   ├── win-conditions.ts      # Pure function
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

---

## Available Scripts

- `npm run dev` - Start development server with watch mode
- `npm run build` - Build the TypeScript project
- `npm run start` - Start production server
- `npm run lint` - Run Biome linter
- `npm run lint:fix` - Fix linting issues with Biome
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once

---

## Technology Stack

- **TypeScript** - Type-safe JavaScript
- **Effect** - Functional error handling and dependency injection
- **Socket.IO** - Real-time bidirectional communication
- **Biome** - Fast linter and formatter
- **Vitest** - Fast unit testing framework
