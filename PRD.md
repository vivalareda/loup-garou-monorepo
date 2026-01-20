# PRD: Effect TS Migration for Loup-Garou Server

## Executive Summary

This document outlines the plan to complete the migration of the Loup-Garou game server from traditional TypeScript/Node.js architecture to Effect TS. The original implementation is preserved in `apps/server.bk`, and the migration has already begun in `apps/server` with core services like Lobby, Game initialization, and Socket handling.

### Current State Analysis

#### ⚠️ Partially Migrated (May Need Extension/Modification)
These services exist but are **incomplete** and will need to be extended or modified during migration:

- **Lobby Service** (`Lobby.ts`) - Basic player joining and name validation. May need extensions for game-start coordination.
- **Game Service** (`Game.ts`) - Basic game initialization and role assignment. **Missing**: voting logic, death processing, lover mechanics, witch potions, hunter revenge, winner detection, and most game state management.
- **Socket Infrastructure** (`SocketServer.ts`, `SocketHandlers.ts`) - Basic socket connection and player joining handler. **Missing**: all game phase event handlers (Cupid, Werewolf, Witch, Day voting, Hunter, etc.).
- **HTTP Server** (`HttpServer.ts`) - Server startup (minimal, may not need changes).
- **Configuration** (`LobbyConfig.ts`) - Lobby settings (minimal, may need game config additions).
- **Audio Manager** (`AudioManager.ts`) - Basic segment audio playback. **Missing**: special scenario audio methods (hunter-lover, partner death, winner announcements, etc.).
- **Error Handling** (`errors.ts`) - Basic error types. **Will need**: additional game-specific errors (voting errors, invalid targets, tie scenarios, etc.).
- **Testing Foundation** - Vitest tests for Lobby, Game, and role assignment. **Needs**: comprehensive game logic tests.

#### ❌ Not Yet Migrated (in `server.bk`)
The majority of the game logic remains in the backup:

**Core Game Logic** (~888 lines)
- `core/death-manager.ts` - Death queue management, team tracking, witch healing
- `core/game-actions.ts` - Segment-specific actions (Cupid, Werewolf, Witch, Day voting)
- `core/special-scenarios.ts` - Edge cases (Hunter-Lover interactions)

**Segment Management** (~294 lines)  
- `segments/segments-manager.ts` - Game flow orchestration, segment transitions, winner detection
- `segments/audio-manager.ts` - Audio playback coordination (partially migrated)

**Event Handling** (~346 lines)
- `server/server-events.ts` - Socket event handlers for all game phases
- `server/events-actions.ts` - Event processing logic

**Testing/Mocking**
- `segments/mock-scenario.ts` - Test scenarios for complex game states

---

## Migration Strategy

### Core Principles
1. **Incremental Migration**: Migrate one cohesive unit at a time (smallest testable piece)
2. **Test-First Approach**: Every migration MUST include comprehensive tests before implementation
3. **Effect Patterns**: Follow Effect best practices (Services, Layers, Error handling via Effect.fail)
4. **Type Safety**: Leverage Effect's type system for compile-time guarantees
5. **Minimal Changes Per Task**: Each task should touch the fewest files possible to enable thorough testing

### Task Granularity Guidelines
- Each task should be completable in 1-3 files
- Each task should have clear, testable acceptance criteria
- Tests should cover happy path, error cases, and edge cases
- Tasks should be independently testable where possible

---

## Phase 1: Core Game Logic Migration

### Task 1.1: DeathManager Service
**Files**: 1-2 | **LOC**: ~150

**Description**: Migrate death queue and team management to Effect service.

**Files to Migrate**:
- `server.bk/src/core/death-manager.ts` → `server/src/services/DeathManager.ts`

**Key Functionality**:
- Team tracking (werewolves vs villagers)
- Pending death queue management
- Death cause tracking (WEREWOLVES, WITCH_POISON, DAY_VOTE, HUNTER_REVENGE, PARTNER_SUICIDE)
- Witch healing logic
- Partner suicide cascade logic

**Effect Patterns to Use**:
- Effect.Service for DeathManager
- Internal mutable state (Map/Array) managed within service closure
- Effect.sync for synchronous operations
- Effect.gen for complex workflows

**Testing Requirements**:
- ✅ Add player to team (werewolf/villager)
- ✅ Add pending death with different causes
- ✅ Remove pending death
- ✅ Check if player is in death queue
- ✅ Heal werewolf victim
- ✅ Partner suicide cascade
- ✅ Multiple deaths in queue
- ✅ Get alive players by team

**Dependencies**: None (independent service)

**Acceptance Criteria**:
- All tests pass with >90% coverage
- Type-safe death cause handling
- State managed within service closure
- Integration with existing Game service

---

### Task 1.2: GameActions Service (Part 1 - Non-Voting Actions)
**Files**: 1 | **LOC**: ~80

**Description**: Migrate segment action handlers (excluding voting logic).

**Files to Migrate**:
- `server.bk/src/core/game-actions.ts` → `server/src/services/GameActions.ts` (partial)

**Key Functionality**:
- `cupidAction()` - Prompt Cupid to pick lovers
- `loversAction()` - Alert lovers of their partner
- `werewolfAction()` - Prompt werewolves to vote
- `witchHealAction()` - Prompt witch to heal
- `witchPoisonAction()` - Prompt witch to poison
- `hunterAction()` - Prompt hunter to pick revenge target
- `announceNightDeaths()` - Broadcast death information

**Effect Patterns to Use**:
- Effect.Service for GameActions
- Dependency on Game, SocketServer, AudioManager
- Effect.gen for action workflows
- Effect.sync for socket emissions

**Testing Requirements**:
- ✅ Cupid action sends correct event to cupid player
- ✅ Lovers action sends events to both lovers with correct partner IDs
- ✅ Werewolf action sends events to all werewolves
- ✅ Witch heal action sends event with victim ID
- ✅ Witch poison action sends prompt to witch
- ✅ Hunter action broadcasts hunter pick event
- ✅ Announce deaths broadcasts all death info
- ✅ Handles missing special role players gracefully

**Dependencies**: Game, SocketServer, AudioManager, DeathManager

**Acceptance Criteria**:
- All tests pass
- Socket emissions are type-safe
- Proper error handling for missing players
- Audio coordination integrated

---

### Task 1.3: Voting Logic - Werewolf Voting
**Files**: 2 | **LOC**: ~120

**Description**: Migrate werewolf voting mechanics with consensus detection.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with voting state
- Extend `server/src/services/GameActions.ts` with voting handlers

**Key Functionality**:
- `handleWerewolfVote()` - Store werewolf vote
- `handleWerewolfUpdateVote()` - Update existing vote
- `calculateWerewolfVoteTallies()` - Count votes by target
- `hasAllWerewolvesAgreed()` - Detect unanimous consensus
- `getWerewolfTarget()` - Return agreed-upon victim
- `broadcastWerewolfVotes()` - Send vote state to all werewolves
- `handleAllWerewolvesAgree()` - Process final victim

**Effect Patterns to Use**:
- Internal Map for vote storage Map<voterSid, targetSid> within service closure
- Effect.gen for vote processing workflows
- Custom errors: InvalidVoterError, InvalidTargetError, VoteMismatchError
- Effect.fail for validation failures

**Testing Requirements**:
- ✅ Single werewolf can vote
- ✅ Multiple werewolves vote for same target → agreement detected
- ✅ Werewolves vote for different targets → no agreement
- ✅ Werewolf updates vote successfully
- ✅ Non-werewolf cannot vote (fails with InvalidVoterError)
- ✅ Cannot vote for another werewolf (fails with InvalidTargetError)
- ✅ Vote tallies calculated correctly
- ✅ Victim added to death queue on agreement
- ✅ Broadcast sends correct vote state to werewolves only

**Dependencies**: Game, SocketServer, DeathManager

**Acceptance Criteria**:
- All tests pass
- Vote state managed within service closure
- Consensus detection is accurate
- Invalid votes fail gracefully with typed errors

---

### Task 1.4: Voting Logic - Day Voting
**Files**: 2 | **LOC**: ~100

**Description**: Migrate day phase voting with tie handling.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with day vote state
- Extend `server/src/services/GameActions.ts` with day vote handlers

**Key Functionality**:
- `handleDayVote()` - Store player vote
- `calculateDayVoteTallies()` - Count votes by target
- `hasAllPlayersVoted()` - Check if all alive players voted
- `getDayVoteTarget()` - Return player with most votes
- `handleDayVotePlayer()` - Process elimination (kill immediately, not pending)
- Tie detection and error handling

**Effect Patterns to Use**:
- Internal Map for vote storage Map<voterSid, targetSid> within service closure
- Effect.gen for vote processing
- Custom error: DayVoteTieError
- Effect.fail for tie scenarios

**Testing Requirements**:
- ✅ Players cast votes
- ✅ All players vote → target determined
- ✅ Target with most votes is selected
- ✅ Tie scenario throws DayVoteTieError
- ✅ Only alive players count toward vote total
- ✅ Dead players cannot vote
- ✅ Voted player dies immediately (not added to pending deaths)
- ✅ Vote state clears after elimination
- ✅ Witch detection (skip witch segments if witch dies)

**Dependencies**: Game, DeathManager, SocketServer

**Acceptance Criteria**:
- All tests pass
- Tie handling implemented correctly
- Vote clearing works
- Death is immediate, not queued

---

### Task 1.5: Death Processing Workflow
**Files**: 2 | **LOC**: ~80

**Description**: Migrate pending death processing with cascading effects.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with death processing
- Integrate with DeathManager service

**Key Functionality**:
- `processPendingDeaths()` - Two-pass death processing:
  - Pass 1: Identify cascade deaths (partner suicides), add to queue
  - Pass 2: Process ALL deaths (original + cascaded)
- Create DeathInfo from PendingDeath
- Mark players as dead
- Alert players of their death
- Handle role-specific death effects (witch loses potions)
- Remove processed deaths from queue

**Effect Patterns to Use**:
- Effect.gen for multi-step processing
- Effect.all for parallel death processing
- Effect.forEach for iterating death queue
- Integration with DeathManager service state

**Testing Requirements**:
- ✅ Process single death (werewolf kill)
- ✅ Process witch poison death
- ✅ Process day vote death
- ✅ Cascade: Lover dies → partner added to queue → both processed
- ✅ Witch dies → potions set to false
- ✅ Hunter dies → hunter action triggered (separate test)
- ✅ Multiple deaths in queue processed correctly
- ✅ Death metadata preserved (hunterId, loverId, voteCount)
- ✅ Players marked as not alive
- ✅ Socket emissions for death alerts

**Dependencies**: Game, DeathManager, SocketServer

**Acceptance Criteria**:
- All tests pass
- Two-pass processing works correctly
- Cascade deaths handled properly
- DeathInfo objects created with full metadata
- Death queue cleared after processing

---

### Task 1.6: Lover Mechanics
**Files**: 2 | **LOC**: ~60

**Description**: Migrate lover tracking and partner suicide logic.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with lover state
- Integrate with DeathManager for partner suicides

**Key Functionality**:
- `setLovers()` - Store two lovers
- `getLovers()` - Retrieve lover pair
- `isPlayerLover()` - Check if player is a lover
- `getPartner()` - Get the other lover
- `hasPartner()` - Check if player has a partner
- Partner suicide detection in death processing
- `isOneOfLoversInDeathQueue()` - Check for lover death triggers
- `isOneOfLoversHunter()` - Check for hunter-lover scenario

**Effect Patterns to Use**:
- Internal lover state (array/tuple) within service closure
- Effect.Option for partner lookup
- Effect.gen for partner checks

**Testing Requirements**:
- ✅ Set lovers successfully
- ✅ Get correct lover pair
- ✅ Check if player is a lover
- ✅ Get partner of a lover
- ✅ Non-lover returns none/error for getPartner
- ✅ Partner suicide triggered when lover dies
- ✅ Both lovers in death queue detected
- ✅ Hunter-lover combination detected

**Dependencies**: Game, DeathManager

**Acceptance Criteria**:
- All tests pass
- Lover state managed within service closure
- Partner lookup is type-safe
- Integration with death processing

---

### Task 1.7: Witch Potion Mechanics
**Files**: 2 | **LOC**: ~50

**Description**: Migrate witch potion tracking and actions.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with witch state
- Integrate with DeathManager for heal/poison

**Key Functionality**:
- `canWitchHeal()` - Check if heal potion available
- `canWitchPoison()` - Check if poison potion available
- `healWerewolfVictim()` - Remove werewolf victim from death queue
- `witchKill()` - Add poison death to queue
- Track potion usage (single-use per game)
- Reset potions on witch death

**Effect Patterns to Use**:
- Internal potion state (two booleans) within service closure
- Effect.gen for potion checks and actions
- Integration with DeathManager heal/poison methods

**Testing Requirements**:
- ✅ Witch starts with both potions
- ✅ Heal potion removes werewolf victim from death queue
- ✅ Heal potion consumed after use
- ✅ Cannot heal twice
- ✅ Poison potion adds player to death queue
- ✅ Poison potion consumed after use
- ✅ Cannot poison twice
- ✅ Witch death removes both potions
- ✅ Both potions can be used in same game (different nights)

**Dependencies**: Game, DeathManager

**Acceptance Criteria**:
- All tests pass
- Potion state tracked within service closure
- Single-use constraint enforced
- Integration with death processing

---

### Task 1.8: Hunter Revenge Mechanics
**Files**: 3 | **LOC**: ~80

**Description**: Migrate hunter revenge mechanics and special scenarios.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with hunter logic
- `server/src/services/GameActions.ts` - Hunter action handling
- Migrate parts of `server.bk/src/core/special-scenarios.ts`

**Key Functionality**:
- `killHunterRevenge()` - Add hunter victim to death queue
- `hunterIsInDeathQueue()` - Detect if hunter died
- `isHunterInLove()` - Check hunter-lover scenario
- `isPartnerHunter()` - Check if surviving lover is hunter
- Special scenario: Hunter dies → partner dies → partner was hunter (double hunter revenge)
- Special scenario: Hunter-lover dies together
- `updateHunterPlayerList()` - Emit death updates for hunter UI

**Effect Patterns to Use**:
- Effect.gen for complex hunter scenarios
- Integration with DeathManager
- AudioManager coordination for special scenarios
- Custom events: HunterInLoveScenario, PartnerHunterScenario

**Testing Requirements**:
- ✅ Hunter dies → hunter action triggered
- ✅ Hunter picks target → target added to death queue
- ✅ Hunter is lover → partner dies → both process correctly
- ✅ Hunter's lover is also hunter → double revenge scenario
- ✅ Day vote kills hunter → immediate hunter action
- ✅ Night kill hunter → delayed hunter action (day phase)
- ✅ Hunter cannot pick werewolf (validation)
- ✅ Hunter death during day vote vs night kill (different flows)

**Dependencies**: Game, DeathManager, SocketServer, AudioManager

**Acceptance Criteria**:
- All tests pass
- Special scenarios handled correctly
- Audio coordination works
- Complex cascade scenarios tested

---

### Task 1.9: Winner Detection Logic
**Files**: 2 | **LOC**: ~50

**Description**: Migrate game-over detection and winner announcement.

**Files to Modify**:
- Extend `server/src/services/Game.ts` with winner logic
- Create `WinnerDetection` helper or integrate into Game

**Key Functionality**:
- `checkIfWinner()` - Determine if game has a winner
  - Werewolves win: 1 werewolf vs 1 villager (except witch with potion)
  - Villagers win: All werewolves dead
  - Game continues: Otherwise
- `getAlivePlayers()` - Filter alive players
- Team-based alive counts
- Special case: Witch with potions can extend game

**Effect Patterns to Use**:
- Effect.gen for winner logic
- Effect.Option for winner result (Some(winner) or None)
- Integration with DeathManager team lists

**Testing Requirements**:
- ✅ All werewolves dead → villagers win
- ✅ 1 werewolf vs 1 villager → werewolves win
- ✅ 1 werewolf vs 1 witch (with heal) → game continues
- ✅ 1 werewolf vs 1 witch (with poison) → game continues
- ✅ 1 werewolf vs 1 witch (no potions) → werewolves win
- ✅ Multiple werewolves and villagers → game continues
- ✅ Lovers scenario: Last two are lovers → special ending (if implemented)

**Dependencies**: Game, DeathManager

**Acceptance Criteria**:
- All tests pass
- Winner detection is accurate
- Special cases handled (witch potions)
- Type-safe winner result

---

## Phase 2: Segment Management Migration

### Task 2.1: Segment State Management
**Files**: 1 | **LOC**: ~80

**Description**: Migrate segment/phase tracking and skip logic.

**Files to Migrate**:
- `server.bk/src/segments/segments-manager.ts` → `server/src/services/SegmentManager.ts` (partial)
- Extend `server/src/services/GamePhase.ts` (currently incomplete)

**Key Functionality**:
- Initialize segment array (CUPID, LOVERS, WEREWOLF, WITCH-HEAL, WITCH-POISON, DAY, HUNTER)
- Track current segment index
- Skip logic for segments:
  - CUPID/LOVERS skip after first night
  - WITCH segments skip if witch dead
  - HUNTER skip unless hunter in death queue
- `findValidSegment()` - Skip over disabled segments
- `getCurrentSegmentType()` - Get current segment type

**Effect Patterns to Use**:
- Effect.Service for SegmentManager
- Internal segment index and array state within service closure
- Effect.gen for segment navigation

**Testing Requirements**:
- ✅ Initialize all segments in correct order
- ✅ Current segment starts at index 0 (CUPID)
- ✅ First night segments marked to skip after execution
- ✅ Witch segments skip when witch dies
- ✅ Hunter segment only active when hunter in death queue
- ✅ findValidSegment skips disabled segments
- ✅ Segment loop wraps correctly (after DAY → WEREWOLF)
- ✅ getCurrentSegmentType returns correct type

**Dependencies**: Game, GamePhase

**Acceptance Criteria**:
- All tests pass
- Segment state managed within service closure
- Skip logic accurate
- Segment transitions are type-safe

---

### Task 2.2: Segment Execution Engine
**Files**: 2 | **LOC**: ~100

**Description**: Migrate segment playback and action execution.

**Files to Modify**:
- Extend `server/src/services/SegmentManager.ts` with execution logic
- Integrate with GameActions service

**Key Functionality**:
- `playSegment()` - Execute current segment:
  - Play segment start audio
  - Execute segment action (call GameActions)
  - Handle special pre-checks (hunter/lover scenarios before DAY)
- `finishSegment()` - Complete segment:
  - Play segment end audio
  - Mark first-night segments as skip
  - Increment segment index
  - Find next valid segment
  - Play next segment
- `startGame()` - Initialize game flow
- Audio-action coordination

**Effect Patterns to Use**:
- Effect.gen for segment workflows
- Effect.zip for parallel audio/action
- Integration with AudioManager
- Integration with GameActions

**Testing Requirements**:
- ✅ playSegment executes segment action
- ✅ finishSegment advances to next segment
- ✅ First night segments skipped after first execution
- ✅ Segment loop cycles correctly
- ✅ Audio plays before action execution
- ✅ Special scenario check before DAY segment
- ✅ Hunter scenario interrupts normal flow
- ✅ Lover scenario interrupts normal flow

**Dependencies**: GameActions, AudioManager, Game, DeathManager

**Acceptance Criteria**:
- All tests pass
- Segment flow executes correctly
- Audio coordination works
- Special scenarios handled

---

### Task 2.3: Special Segment Scenarios
**Files**: 3 | **LOC**: ~120

**Description**: Migrate complex edge case handling for segment flow.

**Files to Migrate**:
- `server.bk/src/core/special-scenarios.ts` → `server/src/services/SpecialScenarios.ts`
- Integrate into `SegmentManager.ts` special checks

**Key Functionality**:
- `checkPostDayVoteScenarios()` - Check for special triggers after day vote:
  - Hunter in death queue → run hunter segment
  - Lover in death queue → run lover death sequence
  - Partner is hunter → run complex hunter-lover scenario
- `runHunterSegment()` - Execute hunter revenge flow
- `runLoverSegment()` - Execute lover death cascade
- `hunterIsLover()` - Audio sequence: night ends → hunter is lover audio
- `partnerIsHunter()` - Audio sequence: night ends → lover death → second is hunter
- `continueDayAction()` - Resume day after special scenario
- `hunterDiedFirst` flag tracking

**Effect Patterns to Use**:
- Effect.Service for SpecialScenarios
- Internal state flags (hunterDiedFirst) within service closure
- Effect.gen for complex flows
- AudioManager integration for multi-step audio

**Testing Requirements**:
- ✅ Hunter in death queue → hunter segment runs
- ✅ Lover in death queue → lover cascade runs
- ✅ Hunter is lover → special audio plays
- ✅ Partner is hunter → double cascade handled
- ✅ Day continues after hunter scenario
- ✅ hunterDiedFirst flag set/cleared correctly
- ✅ Multiple scenarios in same game (sequential)
- ✅ Audio sequences play in correct order

**Dependencies**: Game, DeathManager, AudioManager, SegmentManager

**Acceptance Criteria**:
- All tests pass
- Complex scenarios work end-to-end
- Audio sequences coordinate correctly
- State flags managed properly

---

### Task 2.4: Day Action Split (Death Processing + Voting)
**Files**: 2 | **LOC**: ~60

**Description**: Migrate day segment action with death announcement and voting phases.

**Files to Modify**:
- Extend `server/src/services/GameActions.ts` with day action
- Integrate death processing and voting initiation

**Key Functionality**:
- `dayAction()` - Day segment entry:
  - Process pending deaths (from night)
  - Check for winner
  - If no winner: Delay 7s, then emit voting phase start
- `continueDayAction()` - Resume day after special scenario:
  - If hunter died first: Play post-hunter audio
  - Else: Play day vote audio
  - Continue segment action
- Winner announcement and game end

**Effect Patterns to Use**:
- Effect.gen for day flow
- Effect.delay for 7-second pause
- Integration with winner detection
- AudioManager for winner audio

**Testing Requirements**:
- ✅ Day starts → pending deaths processed
- ✅ Deaths announced to all players
- ✅ Winner detected → game ends, no voting
- ✅ No winner → 7s delay → voting starts
- ✅ Special scenario (hunter) → post-hunter audio → voting
- ✅ Winner announcement plays correct audio (villagers/werewolves)
- ✅ Game state frozen after winner declared

**Dependencies**: Game, DeathManager, AudioManager, SocketServer, SegmentManager

**Acceptance Criteria**:
- All tests pass
- Death processing before voting
- Winner detection terminates game
- Voting phase initiated correctly

---

## Phase 3: Event Handling Migration

### Task 3.1: Socket Event Router
**Files**: 1 | **LOC**: ~50

**Description**: Extend SocketHandlers with game event routing.

**Files to Modify**:
- Extend `server/src/services/SocketHandlers.ts` with event setup methods

**Key Functionality**:
- `setupCupidEvents()` - cupid:lovers-pick
- `setupLoversEvents()` - alert:lover-closed-alert
- `setupWerewolfEvents()` - werewolf:player-voted, werewolf:player-update-vote
- `setupWitchEvents()` - witch:healed-player, witch:poisoned-player, witch:skipped-*
- `setupDayVoteEvents()` - day:player-voted
- `setupHunterEvents()` - hunter:killed-player
- `setupGettersEvents()` - lobby:get-players-list
- Event router structure (delegate to EventsActions)

**Effect Patterns to Use**:
- Effect.runPromise to bridge socket callbacks to Effect
- Effect.catchTags for error handling in event handlers
- Integration with EventsActions service

**Testing Requirements**:
- ✅ Socket connection established
- ✅ Events registered correctly
- ✅ Event handlers call EventsActions methods
- ✅ Errors in handlers logged/caught gracefully
- ✅ Disconnect handled

**Dependencies**: SocketServer, EventsActions

**Acceptance Criteria**:
- All tests pass
- Events properly routed
- Error handling in place

---

### Task 3.2: EventsActions Service (Part 1 - Voting Events)
**Files**: 1 | **LOC**: ~70

**Description**: Migrate voting event processing.

**Files to Migrate**:
- `server.bk/src/server/events-actions.ts` → `server/src/services/EventsActions.ts` (partial)

**Key Functionality**:
- `handleWerewolfVote()` - Process werewolf vote, check consensus, trigger segment end
- `handleDayVote()` - Process day vote, check completion, handle special scenarios
- Special case: Day vote kills hunter
- Special case: Day vote kills lover (with/without hunter)
- Integration with SegmentManager for segment transitions

**Effect Patterns to Use**:
- Effect.Service for EventsActions
- Effect.gen for vote processing
- Dependency on Game, SegmentManager, AudioManager

**Testing Requirements**:
- ✅ Werewolf vote processed
- ✅ All werewolves agree → segment ends
- ✅ Day vote processed
- ✅ All players vote → target eliminated
- ✅ Day vote kills hunter → hunter segment triggered
- ✅ Day vote kills lover → lover cascade triggered
- ✅ Day vote kills hunter-lover → complex scenario triggered

**Dependencies**: Game, SegmentManager, AudioManager, SocketServer

**Acceptance Criteria**:
- All tests pass
- Vote processing works end-to-end
- Special scenarios handled
- Segment transitions triggered correctly

---

### Task 3.3: EventsActions Service (Part 2 - Special Role Events)
**Files**: 1 | **LOC**: ~50

**Description**: Migrate special role event processing.

**Files to Modify**:
- Extend `server/src/services/EventsActions.ts` with special role logic

**Key Functionality**:
- `handleHunterPlayerPick()` - Process hunter target selection:
  - Different flow if hunter killed during day vote vs night
  - Add hunter revenge to death queue
  - Check if hunter is lover → partner suicide
  - Continue segment flow
- `handleDayVoteHunterPlayerPick()` - Special case for day vote hunter death

**Effect Patterns to Use**:
- Effect.gen for hunter processing
- Flag tracking (hunterKilledDuringDayVote)
- Integration with death processing

**Testing Requirements**:
- ✅ Hunter picks target during night death
- ✅ Hunter picks target during day vote death
- ✅ Hunter target added to death queue
- ✅ Hunter is lover → partner dies
- ✅ Different audio flows for night vs day hunter death
- ✅ Segment continues after hunter action

**Dependencies**: Game, SegmentManager, AudioManager

**Acceptance Criteria**:
- All tests pass
- Hunter flows work correctly
- Day vote vs night kill distinguished
- Lover integration works

---

### Task 3.4: Admin/Testing Events
**Files**: 1 | **LOC**: ~40

**Description**: Migrate admin dashboard testing events.

**Files to Modify**:
- Extend `server/src/services/SocketHandlers.ts` with admin events

**Key Functionality**:
- `admin:start-game` - Force game start
- `admin:next-segment` - Force segment advance
- `admin:simulate-werewolf-vote` - Auto-vote all werewolves
- `admin:simulate-day-vote` - Auto-vote all players

**Effect Patterns to Use**:
- Effect.runPromise for admin commands
- Integration with Game and SegmentManager

**Testing Requirements**:
- ✅ Admin start game works
- ✅ Admin next segment advances segment
- ✅ Admin simulate werewolf vote triggers consensus
- ✅ Admin simulate day vote triggers elimination

**Dependencies**: Game, SegmentManager

**Acceptance Criteria**:
- All tests pass
- Admin commands work for testing
- Commands accessible from dashboard

---

### Task 3.5: Mock Scenario Events (Testing Infrastructure)
**Files**: 2 | **LOC**: ~80

**Description**: Migrate complex test scenarios for dashboard testing.

**Files to Migrate**:
- `server.bk/src/segments/mock-scenario.ts` → `server/src/services/MockScenario.ts`

**Key Functionality**:
- `runWerewolfKillHunter()` - Simulate hunter death by werewolves
- `runWerewolfKillLover()` - Simulate lover death by werewolves
- `runWerewolfKillLoverSecondIsHunter()` - Simulate lover dies → partner is hunter
- `runWerewolfKillLoverWhoIsHunter()` - Simulate hunter-lover killed
- `runDayVoteKillHunter()` - Simulate hunter eliminated by day vote
- `runDayVoteKillLover()` - Simulate lover eliminated by day vote
- `runDayVoteKillLoverWhoIsHunter()` - Simulate hunter-lover eliminated by day vote
- `runDayVoteKillLoverSecondIsHunter()` - Simulate lover eliminated, partner is hunter

**Effect Patterns to Use**:
- Effect.Service for MockScenario
- Effect.gen for scenario setup
- Integration with Game state manipulation

**Testing Requirements**:
- ✅ Each mock scenario sets up game state correctly
- ✅ Scenarios trigger expected special flows
- ✅ Scenarios work with dashboard admin events
- ✅ Scenarios reset cleanly

**Dependencies**: Game, SegmentManager, EventsActions

**Acceptance Criteria**:
- All tests pass
- Scenarios accessible from dashboard
- Scenarios accurately test edge cases

---

## Phase 4: Audio Integration Enhancement

### Task 4.1: AudioManager Service Extension
**Files**: 1 | **LOC**: ~40

**Description**: Migrate remaining audio coordination methods.

**Files to Modify**:
- Extend `server/src/services/AudioManager.ts` with additional methods

**Key Functionality**:
- `playHunterAudio()` - Hunter revenge audio
- `playHunterIsLoverAudio()` - Hunter-lover special scenario
- `playSecondLoverIsHunterAudio()` - Partner hunter scenario
- `nightHasEndedAudio()` - Night end announcement
- `playLoverAudio()` - Lover death audio
- `playDayVoteAudio()` - Day vote start audio
- `playPostHunterAudio()` - Day continuation after hunter
- `playDayVoteHunterHasPartner()` - Hunter with partner day vote
- `playDayVoteLoversDeath()` - Lovers die during day vote
- `playVillagersWonAudio()` - Villagers victory
- `playWerewolvesWonAudio()` - Werewolves victory

**Effect Patterns to Use**:
- Effect.gen for audio playback
- Config for audio file paths
- Effect.fork for non-blocking audio

**Testing Requirements**:
- ✅ Each audio method plays correct file
- ✅ Audio files resolve from config
- ✅ Missing audio files handled gracefully
- ✅ Async audio doesn't block game flow

**Dependencies**: LobbyConfig (for assets path)

**Acceptance Criteria**:
- All tests pass
- Audio playback works for all scenarios
- Non-blocking where appropriate

---

## Phase 5: Integration & Polish

### Task 5.1: Full Game Integration Test Suite
**Files**: 1 | **LOC**: ~200

**Description**: Create comprehensive end-to-end integration tests.

**Test Coverage**:
- Full game flow: Lobby → Cupid → Lovers → Werewolf → Witch → Day → Winner
- Werewolf victory scenario
- Villagers victory scenario
- Hunter revenge during night kill
- Hunter revenge during day vote
- Lover cascade during night kill
- Lover cascade during day vote
- Hunter-lover complex scenario
- Partner hunter complex scenario
- Witch heal saves victim
- Witch poison adds death
- All first-night segments skip on second night

**Effect Patterns to Use**:
- Effect.gen for test flows
- Layer composition for full stack
- Mock SocketServer for event testing

**Acceptance Criteria**:
- All integration tests pass
- >85% code coverage across all services
- Game flows work end-to-end

---

### Task 5.2: Error Handling Audit
**Files**: Multiple | **LOC**: ~50

**Description**: Review and enhance error handling across all services.

**Key Actions**:
- Ensure all Effect.fail calls use typed errors
- Add custom errors for all failure modes
- Test error propagation
- Add error recovery where appropriate
- Document error scenarios

**Effect Patterns to Use**:
- Custom error classes
- Effect.catchTags for recovery
- Effect.retry for transient failures

**Acceptance Criteria**:
- All errors are typed
- Error handling tested
- No unhandled promise rejections

---

### Task 5.3: Documentation & Code Cleanup
**Files**: Multiple | **LOC**: ~100

**Description**: Document services and clean up migration artifacts.

**Key Actions**:
- Add JSDoc comments to all service methods
- Document service dependencies
- Add README for server architecture
- Remove `server.bk` directory (preserve in git history)
- Clean up unused imports
- Verify consistent code style

**Acceptance Criteria**:
- All public APIs documented
- Architecture documented
- Backup directory removed
- Lint passes

---

## Testing Strategy

### Test Requirements Per Task
Every task MUST include:
1. **Unit Tests**: Test service methods in isolation
2. **Integration Tests**: Test service interactions
3. **Edge Case Tests**: Test error scenarios and boundaries

### Testing Tools
- **@effect/vitest** - Effect-aware testing
- **Effect Test Layers** - Isolated service testing
- **Mock Services** - Socket, Audio mocks for testing

### Coverage Targets
- Per-task coverage: >90%
- Overall coverage: >85%
- Critical paths: 100% (voting, death processing, winner detection)

---

## Dependencies & Constraints

### Technical Constraints
1. Maintain compatibility with existing mobile/dashboard clients
2. Preserve Socket.io event contracts (types in `@repo/types`)
3. Audio file paths configurable via environment
4. Support server restart (no persistent state required initially)

### Migration Order Constraints
Tasks have dependencies indicated in each task description. Generally:
- Phase 1 tasks can run somewhat in parallel (1.1-1.4)
- Phase 2 requires Phase 1 completion
- Phase 3 requires Phase 1 & 2 completion
- Phase 4 can run in parallel with Phase 3
- Phase 5 requires all previous phases

---

## Success Criteria

### Migration Complete When:
1. ✅ All tasks completed and tested
2. ✅ All tests passing (>85% coverage)
3. ✅ Full game playable end-to-end
4. ✅ All special scenarios working (Hunter-Lover, Witch, etc.)
5. ✅ Mobile client can connect and play without changes
6. ✅ Dashboard testing tools functional
7. ✅ `server.bk` directory removed
8. ✅ Documentation complete

### Non-Goals (Out of Scope)
- Database persistence (future enhancement)
- Authentication/authorization
- Spectator mode
- Replay functionality
- Performance optimization (beyond basic Effect patterns)
- New game features not in `server.bk`

---

## Timeline Estimate

**Assumptions**: One developer, working incrementally with full testing per task.

| Phase | Tasks | Estimated Duration |
|-------|-------|-------------------|
| Phase 1: Core Logic | 1.1 - 1.9 | 3-4 weeks |
| Phase 2: Segment Management | 2.1 - 2.4 | 1.5-2 weeks |
| Phase 3: Event Handling | 3.1 - 3.5 | 1.5-2 weeks |
| Phase 4: Audio | 4.1 | 0.5 week |
| Phase 5: Integration | 5.1 - 5.3 | 1-1.5 weeks |
| **Total** | | **7.5-10 weeks** |

---

## Risk Mitigation

### Risks
1. **Complex Cascade Logic**: Hunter-Lover scenarios are intricate
   - *Mitigation*: Extensive testing, mock scenarios for dashboard testing
2. **State Management**: Concurrent vote updates, death queue mutations
   - *Mitigation*: Use service closure state, careful mutation management, test race conditions
3. **Audio Timing**: Audio-action coordination critical for UX
   - *Mitigation*: Effect.fork for non-blocking, Effect.zip for sequencing
4. **Testing Overhead**: Comprehensive testing takes time
   - *Mitigation*: Incremental testing catches issues early, reduces rework

---

## Appendix: Effect Patterns Reference

### Common Patterns Used in Migration

#### Service Definition
```typescript
export class ServiceName extends Effect.Service<ServiceName>()('@app/ServiceName', {
  effect: Effect.gen(function* () {
    const dep = yield* Dependency;
    
    // Internal mutable state managed within closure
    const internalState = new Map<string, string>();
    
    return {
      method: (arg: Type) => Effect.gen(function* () {
        // implementation using internalState
      })
    };
  }),
  dependencies: [Dependency.Default]
}) {}
```

#### Mutable State Management (Service Closure Pattern)
```typescript
export class MyService extends Effect.Service<MyService>()('@app/MyService', {
  effect: Effect.gen(function* () {
    // State lives in the service closure
    const votes = new Map<string, string>();
    const lovers: Player[] = [];
    
    return {
      addVote: (voterId: string, targetId: string) => 
        Effect.sync(() => {
          votes.set(voterId, targetId);
        }),
      
      getVotes: Effect.sync(() => new Map(votes))
    };
  })
}) {}
```

**Note**: Use `Ref` only when you need reactive state or cross-service shared mutable state. For most cases, service closure state is simpler and sufficient.

#### Error Handling
```typescript
// Define error
export class CustomError extends Data.TaggedError("CustomError")<{
  readonly field: string;
}> {}

// Use error
yield* Effect.fail(new CustomError({ field: value }));

// Catch error
yield* effect.pipe(
  Effect.catchTag("CustomError", (error) => 
    Effect.sync(() => console.log(error.field))
  )
);
```

#### Testing
```typescript
import { describe, expect, it } from '@effect/vitest';

describe('Service', () => {
  const TestLayer = Service.Default.pipe(
    Layer.provide(Dependency.Test)
  );

  it.effect('does something', () =>
    Effect.gen(function* () {
      const service = yield* Service;
      const result = yield* service.method(input);
      expect(result).toBe(expected);
    }).pipe(Effect.provide(TestLayer))
  );
});
```

---

## Questions for Clarification

Before starting implementation, confirm:

1. **Persistence**: Do we need database persistence for game state, or in-memory is OK for now?
2. **Real-time Constraints**: Any specific latency requirements for socket events?
3. **Lobby Management**: Should we add reconnection handling, or is that out of scope?
4. **Testing Infrastructure**: Do we have access to real audio files, or mock them in tests?
5. **Mobile Client Changes**: Can we make breaking changes to socket events if needed, or must maintain compatibility?
6. **Game Restart**: Keep the keyboard 'r' restart functionality, or migrate differently?

---

**End of PRD**
