# Loup-Garou Game Documentation

## Overview

This is a real-time multiplayer implementation of the classic Werewolf (Loup-Garou) party game. The project consists of three main components:

- **Server** (`apps/server`): Node.js game engine with Socket.io for real-time communication
- **Mobile App** (`apps/mobile`): React Native/Expo mobile client for players  
- **Dashboard** (`apps/dashboard`): React web dashboard for testing and debugging with mock players

## Game Flow Architecture

### Core Components

#### 1. Segments Manager (`apps/server/src/segments/segments-manager.ts`)
The heart of the game flow. Manages the sequential execution of game phases (segments).

**Key Responsibilities:**
- Orchestrates the game phases in order
- Plays audio files for each segment
- Triggers segment actions via GameActions
- Handles segment progression and looping

**Flow:**
```
Start Game → Play Segment Audio → Execute Segment Action → Wait for Completion → Next Segment
```

#### 2. Game Actions (`apps/server/src/core/game-actions.ts`)
Executes specific actions for each game segment and manages player interactions.

#### 3. Game Class (`apps/server/src/core/game.ts`)
Central game state management including players, roles, teams, and game mechanics.

## Game Segments

The game follows a structured sequence of segments that repeat each night/day cycle:

### Night Segments (First Night Only)
1. **CUPID** - Cupid selects two players to become lovers
2. **LOVERS** - Selected lovers are notified of their bond

### Night Segments (Every Night)
3. **WEREWOLF** - Werewolves choose a victim *(not yet implemented)*
4. **WITCH** - Witch can use healing/poison potions *(not yet implemented)*
5. **SEER** - Seer investigates a player's role *(not yet implemented)*

### Day Segments
6. **DAY** - Village discussion and voting *(not yet implemented)*

## Socket Events

### Server to Client Events

#### Lobby Events
- **`lobby:player-data`** `(player: Player)` - Sends player's own data after joining
- **`lobby:player-left`** `(playerName: string)` - Notifies when a player leaves  
- **`lobby:update-players-list`** `(player: PlayerListItem)` - Adds new player to client's list
- **`lobby:players-list`** `(playersList: PlayerListItem[])` - Sends complete players list

#### Game Events  
- **`player:role-assigned`** `(role: Role)` - Assigns role to player at game start
- **`cupid:pick-required`** `()` - Prompts Cupid to select lovers

#### Alert Events
- **`alert:player-is-lover`** `(loverName: string)` - Notifies player they are a lover
- **`alert:lovers-can-close-alert`** `()` - Allows lover to close the alert notification

### Client to Server Events

#### Lobby Events
- **`lobby:get-players-list`** `()` - Requests current players list
- **`player:join`** `(playerName: string)` - Player joins the waiting room

#### Action Events
- **`cupid:lovers-pick`** `(selectedPlayers: string[])` - Cupid submits lover selection
- **`alert:lover-closed-alert`** `()` - Lover confirms they've seen the alert

## Roles & Game Mechanics

### Available Roles

#### Villager Team
- **VILLAGER** - Basic villager with no special abilities
- **SEER** - Can investigate one player's role each night
- **HUNTER** - Can eliminate another player upon death  
- **CUPID** - Selects two lovers on the first night (dies if lovers are eliminated)
- **WITCH** - Has healing and poison potions (one-time use each)

#### Werewolf Team  
- **WEREWOLF** - Eliminates villagers each night

### Role Distribution Logic
Based on player count (`apps/server/src/core/game.ts:32-55`):

- **4+ players**: 1 Werewolf, 1 Seer, remaining Villagers
- **6+ players**: +1 Witch  
- **8+ players**: +1 Hunter, +1 Cupid
- **Additional Werewolves**: 1 per 3 players (rounded down)

### Special Mechanics

#### Lovers System
1. Cupid selects two players on the first night
2. If one lover dies, the other dies immediately  
3. Lovers win together regardless of their original team

#### Team Victory Conditions *(planned)*
- **Villagers**: Eliminate all werewolves
- **Werewolves**: Equal or outnumber villagers  
- **Lovers**: Both survive to the end (alternative win condition)

## Current Implementation Status

### ✅ Implemented
- **Lobby System**: Player joining, role assignment, real-time player list
- **Cupid Segment**: Lover selection functionality
- **Lovers Alert**: Notification system for selected lovers
- **Dashboard**: Mock player testing with full lover functionality
- **Audio System**: Segment-based audio playback
- **Core Architecture**: Segments manager, game actions, event system

### 🚧 In Progress  
- **Socket Event Naming**: Recently standardized to `type:action` format
- **Player Identification**: Resolving SID vs name inconsistencies

### ❌ Not Yet Implemented
- **Werewolf Night Actions**: Victim selection
- **Witch Actions**: Healing/poison mechanics  
- **Seer Actions**: Role investigation
- **Day Phase**: Village discussion and voting
- **Death System**: Player elimination and game state updates
- **Victory Conditions**: Win/lose detection
- **Advanced Roles**: Additional special roles

## Development Architecture

### Monorepo Structure
```
packages/types/          # Shared TypeScript types
├── src/
│   ├── event.ts        # Socket event definitions
│   ├── player.ts       # Player type definitions  
│   ├── role.ts         # Role definitions and descriptions
│   └── segment.ts      # Game segment definitions

apps/server/            # Node.js game server
├── src/core/          # Game logic
├── src/segments/      # Segment management
├── src/server/        # HTTP and Socket.io server
└── assets/           # Audio files for game segments

apps/mobile/           # React Native player app  
├── app/(game)/       # Game interface screens
├── hooks/            # Game state management hooks
└── utils/           # Socket connection utilities

apps/dashboard/        # React testing dashboard
├── src/components/   # UI components
├── src/store/       # Mock player state management  
└── src/utils/      # Socket utilities for mock players
```

### Key Design Patterns

#### Event-Driven Architecture
- Socket.io events drive all game interactions
- Segments manager orchestrates game flow via events
- Asynchronous event handling for real-time gameplay

#### State Management
- **Server**: Centralized game state in Game class
- **Mobile**: Zustand stores for local player state  
- **Dashboard**: Zustand stores for mock player testing

#### Type Safety
- Shared TypeScript types across all applications
- Strongly typed Socket.io events prevent runtime errors
- Consistent data structures for players, roles, and events

## Testing & Development

### Dashboard Mock Players
The dashboard allows creating multiple mock players for testing:

- **Individual Socket Connections**: Each mock player has its own Socket.io connection
- **Real-time State Tracking**: Monitor player states, role assignments, lover status
- **Interactive Testing**: Send events, close alerts, observe game flow
- **Multi-client Simulation**: Test scenarios with multiple concurrent players

### Development Workflow
1. **Server**: Start with `pnpm dev:server` 
2. **Dashboard**: Start with `pnpm dev` for testing
3. **Mobile**: Start with `pnpm dev:native` for mobile testing
4. **Create Mock Players**: Use dashboard to simulate multiplayer scenarios
5. **Test Game Flow**: Trigger segments and observe event handling

## Future Enhancements

### Planned Features
- **Complete Night Phase**: Werewolf, Witch, and Seer actions
- **Day Phase Implementation**: Discussion timer, voting system
- **Advanced Roles**: Mayor, Little Girl, Wild Child, etc.
- **Game Variants**: Different rule sets and role combinations
- **Spectator Mode**: Observer functionality for eliminated players
- **Game Statistics**: Player performance tracking and game history

### Technical Improvements
- **Persistent Game State**: Database integration for game recovery
- **Scalability**: Multi-room support for concurrent games  
- **Mobile Features**: Push notifications, offline mode
- **Audio Enhancements**: Custom voice packs, volume controls
- **UI/UX**: Enhanced mobile interface, accessibility features

---

*This documentation reflects the current state of the Loup-Garou implementation and will be updated as new features are added.*
