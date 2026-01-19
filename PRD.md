# Project: Werewolf Server (Effect-TS)

## Context
Build a new game server in `apps/server` using Effect-TS.

## Rules for OpenCode
- **Language**: TypeScript (idiomatic Effect).
- **Style**: Use `Effect.gen`, `Context.Tag`, and `Layer`.
- **Validation**: Use `@effect/schema` for all data.
- **Testing**: Use `vitest`. Create a test file for every service.
- **Errors**: No `any`. Use `Data.TaggedError` for domain errors.

---

## Phase 1: Infrastructure
- [ ] **Setup Project**: Initialize `apps/server`, configure a strict `tsconfig.json`, and install `effect`, `@effect/schema`, and `vitest`.
- [x] **Player Domain**: Create `src/Domain/Player.ts`. Define `PlayerId` (branded string) and `Player` schema.
- [ ] **PlayerRepository**: Create `src/Services/PlayerRepository.ts`. Implement a service using `Ref` to manage players in-memory.
- [ ] **Test Players**: Create `test/PlayerRepository.test.ts`. Verify add/remove logic.

## Phase 2: Game State & Loop
- [ ] **State Domain**: Create `src/Domain/GameState.ts`. Define a union of states: `Lobby`, `Night`, `Day`, `Voting`.
- [ ] **GameManager**: Create `src/Services/GameManager.ts`. Handle the logic for transitioning from one phase to the next.
- [ ] **Test GameLoop**: Create `test/GameManager.test.ts`. Ensure transitions are valid and error on invalid moves.

## Phase 3: Voting logic
- [ ] **Voting Service**: Create `src/Services/Voting.ts`. Logic to aggregate votes and return a result (Winner or Tie).
- [ ] **Test Voting**: Create `test/Voting.test.ts` with edge cases for ties.

## Phase 4: Main Entry
- [ ] **Application Entry**: Create `src/main.ts`. Wire all Layers together and create a runnable Effect entry point.
