# PRD: Migrate Loup-Garou Server to Effect-TS

## Introduction
Migrate the game server from traditional async/await patterns to Effect-TS 
for better type safety, error handling, and testability. All code will follow 
idiomatic Effect patterns verified against the Effect-TS submodule, with 
comprehensive test coverage.

## Goals
- Replace manual error handling with Effect's typed error channels
- Implement dependency injection using Effect Context
- Make async operations composable and testable
- Achieve 100% test coverage for migrated modules
- Follow idiomatic Effect patterns from the Effect-TS source
- Maintain 100% feature parity during migration

## User Stories

### US-001: Set up Effect-TS infrastructure and testing
**Description:** As a developer, I need Effect-TS configured with testing infrastructure so I can write idiomatic, tested Effect code.

**Acceptance Criteria:**
- [x] Install `effect` package in server
- [x] Configure Effect submodule in git (already done)
- [x] Set up Effect test utilities (@effect/vitest or similar)
- [x] Create base Effect types and utilities
- [x] Add script to reference Effect submodule examples
- [x] Create test helpers for Effect assertions
- [x] Document how to reference Effect submodule patterns
- [x] Typecheck passes
- [x] All existing tests still pass

### US-002: Migrate DeathManager to Effect with tests
**Description:** As a developer, I need DeathManager using Effect so death operations are type-safe and testable.

**Acceptance Criteria:**
- [x] Reference Effect submodule for idiomatic patterns
- [x] Convert class methods to Effect functions
- [x] Add proper error types (DeathManagerError)
- [x] Implement using Effect.Service for DI
- [x] Write unit tests for all DeathManager methods
- [x] Test error scenarios with Effect.runPromiseExit
- [x] Test concurrent death operations
- [x] 100% test coverage for DeathManager
- [x] Typecheck passes
- [x] All tests pass

### US-003: Migrate Game class core methods with tests
**Description:** As a developer, I need Game class using Effect for state operations with comprehensive tests.

**Acceptance Criteria:**
- [x] Review Effect submodule Ref/State patterns
- [x] Convert player management methods to Effect
- [x] Convert role assignment to Effect pipeline
- [x] Add error types (GameError)
- [x] Use Effect.Ref for game state management
- [x] Write tests for player lifecycle operations
- [x] Write tests for role assignment edge cases
- [x] Write tests for state consistency
- [x] Test error handling for invalid operations
- [x] 100% test coverage for migrated methods
- [x] Typecheck passes
- [x] All tests pass
- [x] Existing game flow still works

### US-004: Create Socket.io Effect wrapper with tests
**Description:** As a developer, I need Socket.io wrapped in Effect so events are composable and testable.

**Acceptance Criteria:**
- [x] Review Effect submodule integration patterns
- [x] Create Effect.Service for Socket.io
- [x] Wrap emit in Effect with error handling
- [x] Wrap on/once in Effect streams
- [x] Add SocketError error type
- [x] Write tests for socket emit operations
- [x] Write tests for socket event streams
- [x] Write tests for connection failures
- [x] Test concurrent socket operations
- [x] Mock Socket.io in tests using Effect.Layer
- [x] 100% test coverage
- [x] Typecheck passes
- [x] All tests pass

### US-005: Migrate AudioManager to Effect with tests
**Description:** As a developer, I need AudioManager using Effect for audio operations with full test coverage.

**Acceptance Criteria:**
- [x] Review Effect submodule async patterns
- [x] Wrap sound-play in Effect
- [x] Add AudioError error type
- [x] Implement timeout using Effect.timeout
- [x] Create audio queue with Effect.Queue
- [x] Write tests for audio playback
- [x] Write tests for audio queue management
- [x] Write tests for timeout scenarios
- [x] Write tests for concurrent audio requests
- [x] Mock sound-play in tests
- [x] 100% test coverage
- [x] Typecheck passes
- [x] All tests pass

### US-006: Migrate SegmentsManager orchestration with tests
**Description:** As a developer, I need SegmentsManager using Effect for game flow with comprehensive tests.

**Acceptance Criteria:**
- [x] Review Effect submodule workflow patterns
- [x] Convert segment execution to Effect pipeline
- [x] Use Effect.Deferred for segment transitions
- [x] Implement segment concurrency with Effect
- [x] Add SegmentError error types
- [x] Write tests for segment execution flow
- [x] Write tests for segment transitions
- [x] Write tests for segment skip logic
- [ ] Write tests for error recovery
- [x] Test concurrent segment operations
- [x] 100% test coverage
- [x] Typecheck passes
- [x] All tests pass
- [x] Game segments execute correctly

### US-007: Migrate GameActions to Effect with tests
**Description:** As a developer, I need GameActions using Effect for action execution with full test coverage.

**Acceptance Criteria:**
- [ ] Review Effect submodule action patterns
- [ ] Convert action methods to Effect
- [ ] Add ActionError error types
- [ ] Integrate with Effect-based services
- [ ] Write tests for all game actions
- [ ] Write tests for action error scenarios
- [ ] Write tests for action side effects
- [ ] Test action composition
- [ ] Mock dependencies using Effect.Layer
- [ ] 100% test coverage
- [ ] Typecheck passes
- [ ] All tests pass

### US-008: Create Effect-based dependency injection with tests
**Description:** As a developer, I need DI using Effect Context instead of constructors, fully tested.

**Acceptance Criteria:**
- [ ] Review Effect submodule Context patterns
- [ ] Define Context for Game, AudioManager, etc.
- [ ] Create Effect.Layer for each service
- [ ] Replace constructor injection with Context
- [ ] Update initialization in index.ts to use Runtime
- [ ] Write tests for service composition
- [ ] Write tests for layer dependencies
- [ ] Test service lifecycle
- [ ] Create test layers for mocking
- [ ] Document DI patterns used
- [ ] 100% test coverage for DI setup
- [ ] Typecheck passes
- [ ] All tests pass

### US-009: Integration tests for full game flow
**Description:** As a developer, I need integration tests verifying the entire Effect-based game works correctly.

**Acceptance Criteria:**
- [ ] Write integration test for full game setup
- [ ] Write integration test for night phase
- [ ] Write integration test for day phase
- [ ] Write integration test for death mechanics
- [ ] Write integration test for win conditions
- [ ] Write integration test for error recovery
- [ ] All integration tests pass
- [ ] Test coverage report shows >95% overall
- [ ] Performance benchmarks show no regression
- [ ] Typecheck passes

## Non-Goals
- Migrating mobile or dashboard apps (separate PRDs)
- Changing game logic or features
- Performance optimization beyond maintaining current performance
- Adding new Effect-only features

## Technical Considerations
- Use Effect submodule at `apps/server/effect/` for reference patterns
- Reference Effect source for idiomatic patterns (especially src/Effect.ts, src/Context.ts)
- Use Effect Schema for runtime validation where beneficial
- Keep socket.io integration working during migration
- Use Effect.Layer for all service dependencies
- Use Effect.Test for test utilities
- Use Effect.runPromise for async test assertions
- Consider Effect.Resource for lifecycle management
- Use Effect.Ref/Deferred for state management
- Document which Effect patterns are used and why

## Testing Strategy
- Unit tests for each migrated module (vitest)
- Integration tests for game flow
- Mock external dependencies (socket.io, sound-play) with Effect.Layer
- Use Effect.runPromiseExit to test error scenarios
- Achieve >95% code coverage
- Performance benchmarks to prevent regression

## Success Metrics
- Zero regression in game functionality
- 100% of migrated code has passing tests
- >95% code coverage overall
- Type safety improved (zero `any` types in migrated code)
- Error handling explicit and typed
