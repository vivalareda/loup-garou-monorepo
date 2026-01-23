# PRD: Server State Dashboard (`/server` route)

## Overview

Add a `/server` route to the dashboard application that provides real-time visibility into the server's internal state. This enables faster debugging during development by exposing lobby state, game state, player data, and event logs in a single view.

## Problem

Currently, debugging the server requires:
- Reading console logs scattered across terminal output
- Manually emitting socket events to inspect state
- No visibility into internal service state (Lobby, Game, GameFlow)
- Difficulty correlating client actions with server state changes

## Solution

A dedicated server inspection page that:
1. Subscribes to server state via debug socket events
2. Displays all relevant state in an organized, real-time UI
3. Provides action buttons for common debugging operations

---

## Tasks

### 1. Route & Navigation

- [ ] Add `/server` route with `ServerDashboard` component
- [ ] Add navigation to switch between `/` (Players) and `/server` (Server)
- [ ] Add current route indicator in navigation

### 2. Data Layer

- [ ] Create `useServerDebugState` hook for socket subscription
- [ ] Create `server-debug.ts` Zustand store for debug state
- [ ] Implement subscription mode (server pushes state on change)
- [ ] Implement polling mode fallback (fetch every 1-2 seconds)
- [ ] Add toggle between subscription/polling modes
- [ ] Add manual refresh button

### 3. Connection Status Panel

- [ ] Display connection status (connected/disconnected)
- [ ] Display server URL
- [ ] Display socket ID
- [ ] Add Reconnect button
- [ ] Add Disconnect button

### 4. Lobby State Panel

- [ ] Display player count / max players
- [ ] Display player table (name, socket ID)
- [ ] Add Clear Lobby action button

### 5. Game State Panel

- [ ] Display game active/inactive status
- [ ] Display current segment with index (e.g., "2/6")
- [ ] Display all segments with visual indicator for current
- [ ] Display alive/total player count
- [ ] Display player table (name, role, alive status, lover)
- [ ] Display special roles mapping

### 6. Event Log Panel

- [ ] Display scrolling event log
- [ ] Auto-scroll to bottom (toggleable)
- [ ] Filter by event type (socket/game/error)
- [ ] Search/filter by text
- [ ] Expandable rows for full data inspection
- [ ] Color coding by event type
- [ ] Add Clear button

### 7. Debug Actions Panel

- [ ] Start Game button
- [ ] Next Segment button
- [ ] Reset Server button
- [ ] Kill Random Player button
- [ ] Trigger Win Check button

### 8. Polish

- [ ] Dark mode support (match existing dashboard)
- [ ] Responsive layout
- [ ] Keyboard shortcut: `R` - Refresh state
- [ ] Keyboard shortcut: `C` - Clear event log
- [ ] Persist filter preferences in localStorage
- [ ] Persist auto-scroll preference in localStorage

---

## Data Requirements

The dashboard needs to display the following server state:

### `ServerDebugState` Shape

```typescript
type ServerDebugState = {
  timestamp: string;
  
  lobby: {
    playerCount: number;
    maxPlayers: number;
    players: Array<{
      name: string;
      socketId: string;
      joinedAt: string;
    }>;
  };
  
  game: {
    isActive: boolean;
    players: Array<{
      name: string;
      socketId: string;
      role: Role;
      isAlive: boolean;
    }>;
    lovers: [string, string] | null; // socket IDs
    specialRoles: Record<Role, string | null>; // role -> socketId
  };
  
  gameFlow: {
    currentSegment: SegmentType | null;
    segmentIndex: number;
    segments: Array<{
      type: SegmentType;
      skip: boolean;
    }>;
  };
  
  connections: {
    total: number;
    socketIds: string[];
  };
}

type DebugEvent = {
  id: string;
  timestamp: string;
  type: 'socket' | 'game' | 'error';
  event: string;
  data?: unknown;
  socketId?: string;
}
```

Server will need to expose socket events to provide this data (implementation details TBD).

---

## UI Mockups

### Connection Status Panel
```
+---------------------------+
| Server Connection         |
| Status: Connected         |
| URL: ws://localhost:3000  |
| Socket ID: abc123         |
| [Reconnect] [Disconnect]  |
+---------------------------+
```

### Lobby State Panel
```
+---------------------------+
| Lobby (3/12 players)      |
+---------------------------+
| Name     | Socket ID      |
|----------|----------------|
| Alice    | sock_abc123    |
| Bob      | sock_def456    |
| Charlie  | sock_ghi789    |
+---------------------------+
| [Clear Lobby]             |
+---------------------------+
```

### Game State Panel
```
+---------------------------------------+
| Game State: ACTIVE                    |
+---------------------------------------+
| Current Segment: WEREWOLF (2/6)       |
| Segments: [CUPID] [LOVERS] [WEREWOLF] |
|           [WITCH] [SEER] [DAY_VOTE]   |
+---------------------------------------+
| Players (5 alive / 7 total)           |
+---------------------------------------+
| Name    | Role     | Alive | Lover    |
|---------|----------|-------|----------|
| Alice   | WEREWOLF | Yes   | -        |
| Bob     | VILLAGER | Yes   | Charlie  |
| Charlie | SEER     | Yes   | Bob      |
| Dave    | WITCH    | No    | -        |
+---------------------------------------+
| Special Roles:                        |
| CUPID: Eve | SEER: Charlie | ...      |
+---------------------------------------+
```

### Event Log Panel
```
+------------------------------------------+
| Event Log                    [Clear]     |
+------------------------------------------+
| 13:45:02 [SOCKET] player:join - Alice    |
| 13:45:03 [SOCKET] player:join - Bob      |
| 13:45:10 [GAME] startGame                |
| 13:45:10 [GAME] role assigned WEREWOLF   |
| 13:45:15 [SOCKET] werewolf:player-voted  |
| 13:45:20 [ERROR] PlayerNotFoundError     |
+------------------------------------------+
```

### Debug Actions Panel
```
+---------------------------+
| Debug Actions             |
+---------------------------+
| [Start Game]              |
| [Next Segment]            |
| [Reset Server]            |
| [Kill Random Player]      |
| [Trigger Win Check]       |
+---------------------------+
```

---

## File Structure

```
apps/dashboard/src/
├── routes/
│   └── server.tsx             # "/server" - server debug page
├── components/
│   ├── navigation.tsx         # Route switching
│   └── server/
│       ├── connection-panel.tsx
│       ├── lobby-panel.tsx
│       ├── game-panel.tsx
│       ├── event-log-panel.tsx
│       └── debug-actions-panel.tsx
├── hooks/
│   └── use-server-debug.ts    # Debug socket subscription
└── store/
    └── server-debug.ts        # Zustand store for debug state
```

---

## Success Criteria

- [ ] Can view all lobby players without console logs
- [ ] Can see game state (roles, alive status) at a glance
- [ ] Can track which segment the game is in
- [ ] Can see real-time event flow
- [ ] Can trigger debug actions without using admin socket events manually
- [ ] State updates within 100ms of server changes (subscription mode)

---

## Out of Scope (Future)

- Time-travel debugging (replay events)
- State diffing (highlight what changed)
- Multiple server connections
- Export/import state snapshots
- Performance profiling
