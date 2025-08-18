# Loup-Garou (Werewolf Game)

A real-time multiplayer implementation of the classic social deduction game "Werewolf" (Loup-Garou) built with TypeScript, React Native, and Socket.io.

## About

Loup-Garou is a digital adaptation of the popular party game where players are secretly assigned roles as either villagers or werewolves. The game consists of day and night phases where players must use deduction, strategy, and social skills to identify and eliminate the opposing team.

**Game Features:**
- Real-time multiplayer gameplay via WebSockets
- Multiple character roles (Villager, Werewolf, Seer, Hunter, Cupid, Witch)
- Audio-guided game segments
- Interactive role assignments and special actions
- Cross-platform mobile support

## Project Structure

This is a **Turborepo monorepo** containing three main applications:

```
loup-garou/
├── apps/
│   ├── mobile/          # React Native mobile app (Expo)
│   ├── server/          # Node.js backend with Socket.io
│   └── dashboard/       # React web dashboard for testing
├── packages/
│   └── types/           # Shared TypeScript types
└── turbo.json          # Turborepo configuration
```

### Applications

- **Mobile App** (`apps/mobile/`) - React Native mobile client for players
- **Server** (`apps/server/`) - Node.js backend handling game logic and WebSocket connections
- **Dashboard** (`apps/dashboard/`) - Web-based testing interface with mock players for development

## Tech Stack

- **TypeScript** - Type safety across the entire stack
- **React Native + Expo** - Cross-platform mobile development
- **Socket.io** - Real-time bidirectional communication
- **Node.js** - Backend server runtime
- **Zustand** - State management
- **TailwindCSS** - Utility-first styling
- **Turborepo** - Monorepo build system and task runner

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm package manager

### Installation

```bash
# Install dependencies
pnpm install
```

### Development

```bash
# Start all applications in development mode
pnpm dev

# Or start individual applications:
pnpm dev:server    # Backend server
pnpm dev:mobile    # Mobile app (Expo)
pnpm dev:dashboard # Testing dashboard
```

### Environment Setup

1. **Mobile App**: Create `apps/mobile/.env` based on `.env.example`
2. **Server**: No additional environment setup required (uses defaults)
3. **Dashboard**: Create `apps/dashboard/.env` if needed

## Available Scripts

- `pnpm dev` - Start all applications in development mode
- `pnpm build` - Build all applications for production
- `pnpm check-types` - TypeScript type checking across all apps
- `pnpm lint` - Lint all applications
- `pnpm clean` - Clean build outputs and node_modules

## Game Development

The dashboard (`apps/dashboard/`) provides a testing environment where you can:
- Create multiple mock players with individual socket connections
- Batch add players for testing
- Monitor game state and player interactions
- Test role assignments and special actions

This makes it easy to develop and test multiplayer game features without needing multiple physical devices.
