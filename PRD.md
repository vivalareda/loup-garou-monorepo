# Loup-Garou Server - Architecture Implementation Tasks

## Phase 1: Pure Functions (Foundation Layer)

- [x] Task 1.1: Extract vote tallying logic from apps/server.bk/src/core/game.ts into apps/server/src/services/vote-tallying.ts as pure functions. Create calculateTallies(votes), hasAllVoted(voters, votes), getWinningTarget(tallies), checkForTie(tallies). All functions must be pure (no side effects). Create vote-tallying.test.ts with tests for correct tallies, null when no winner, tie detection. Must achieve >95% coverage.

- [x] Task 1.2: Extract win condition logic from apps/server.bk/src/core/game.ts into apps/server/src/services/win-conditions.ts as pure function. Create checkWinner(aliveWerewolves, aliveVillagers, witchHasPotions) returning 'villagers' | 'werewolves' | null. Test all scenarios: 0 werewolves (villagers win), equal numbers with witch potions (continues), equal numbers without potions (werewolves win), werewolves outnumber (werewolves win). Must achieve >95% coverage.

- [x] Task 1.3: Verify apps/server/src/services/role-assignment.ts is complete pure function extracted from Game service. If still inside Game.ts, extract initRolesList(playerCount, rng?) and shuffleArray(array, rng) as standalone pure functions. Ensure role-assignment.test.ts exists with tests for 4/5/6/8/10 player counts, witch at 6+, hunter at 8+, deterministic with seeded RNG. Must achieve >95% coverage.

## Phase 2: Game Service - Voting Logic

- [x] Task 2.1: Read apps/server.bk/src/core/game.ts werewolf voting implementation in full. Extend apps/server/src/services/Game.ts to add werewolf voting state (Map<voterSid, targetSid>) and methods: handleWerewolfVote(voterSid, targetSid), getWerewolfVoteTallies(), hasAllWerewolvesAgreed(), getWerewolfTarget(), clearWerewolfVotes(). Use vote-tallying.ts pure functions internally. Create InvalidVoteError in errors.ts. Add comprehensive tests in game.test.ts for vote recording, tallies, unanimous agreement, invalid voter rejection. Must achieve >90% coverage for voting logic.

- [x] Task 2.2: Read apps/server.bk/src/core/game.ts day voting implementation in full. Extend apps/server/src/services/Game.ts to add day voting state (Map<voterSid, targetSid>) and methods: handleDayVote(voterSid, targetSid), getDayVoteTallies(), hasAllPlayersVoted(), getDayVoteTarget(), clearDayVotes(). Use vote-tallying.ts pure functions internally. Create TieVoteError and NoTargetError in errors.ts. Add comprehensive tests for vote recording, tallies, most votes wins, tie detection. Must achieve >90% coverage for day voting.

## Phase 3: Game Service - Death & Special Mechanics

- [x] Task 3.1: Read apps/server.bk death processing logic across game.ts and death-manager.ts in full. Extend apps/server/src/services/Game.ts to add death management methods: addPendingDeath(sid, cause), processPendingDeaths(), isInDeathQueue(sid), hunterIsInDeathQueue(), killPlayer(sid). Death processing must handle two-pass cascade (partner suicides), mark players dead, return DeathInfo array. Create death-processing.test.ts with tests for single death, lover cascade, hunter detection, witch death, multiple deaths. Must achieve >90% coverage.

- [x] Task 3.2: Read apps/server.bk witch mechanics across game.ts and game-actions.ts in full. Extend apps/server/src/services/Game.ts to add witch potion methods: canWitchHeal(), canWitchPoison(), witchHeal(), witchPoison(targetSid). Track heal/poison availability (single-use), heal removes werewolf victim from death queue, poison adds to death queue, witch death removes both potions. Add tests in game.test.ts for heal removes victim, poison adds death, single-use constraint, witch death. Must achieve >90% coverage for witch logic.

- [x] Task 3.3: Verify apps/server/src/services/Game.ts lover methods are complete: setLovers(firstSid, secondSid), getPartner(sid), isPlayerLover(sid), isAnyLoverHunter(), getLovers(). If incomplete, read apps/server.bk lover implementation and add missing logic. Partner suicide must be integrated with death processing. Ensure lovers.test.ts exists with tests for set/get lovers, partner lookup, hunter-lover detection, partner suicide cascade. Must achieve >90% coverage.

- [x] Task 3.4: Extend apps/server/src/services/Game.ts to add checkWinner() method that uses win-conditions.ts pure function. Method must count alive werewolves/villagers, check witch potion status, call checkWinner(aliveWerewolves, aliveVillagers, witchHasPotions), return result. Add tests in game.test.ts for all win scenarios using checkWinner method. Must achieve >90% coverage for win detection.

## Phase 4: AudioManager Completion

- [x] Task 4.1: Read apps/server.bk/src/segments/audio-manager.ts in full. Compare with apps/server/src/services/AudioManager.ts. Identify ALL missing audio methods. Extend AudioManager.ts to add: playIntro(), playSegmentStart(segment), playSegmentEnd(segment), playWinnerAudio(winner), playHunterDeath(), playLoverDeath(), playHunterWithLoverDeath(), playDeathAnnouncement(hasDeaths). Create AudioManager.Test layer with no-op implementations for all methods. No unit tests needed (I/O wrapper), but ensure Test layer is complete.

## Phase 5: GameFlow Service (Orchestration)

- [x] Task 5.1: Read apps/server.bk/src/segments/segments-manager.ts segment state and skip logic in full. Create apps/server/src/services/GameFlow.ts as Effect.Service with SegmentState internal state tracking segment types (CUPID, LOVERS, WEREWOLF, WITCH_HEAL, WITCH_POISON, DAY, HUNTER) and skip flags. Implement skipSegment(type) method. Add segment skip logic: Cupid/Lovers skip after first night, Witch segments skip when no potions, Hunter skip unless in death queue. Add tests for skip logic and segment state. Must achieve >85% coverage.

- [x] Task 5.2: Read apps/server.bk/src/segments/segments-manager.ts phase execution in full. Extend apps/server/src/services/GameFlow.ts to add startGame(), runNightPhase(), runDayPhase() methods. These orchestrate audio playback (AudioManager) and socket emissions (SocketServer) for each segment. Add continuation methods: continueAfterCupid(), continueAfterLoversReveal(), continueAfterWerewolfVote(), continueAfterWitchHeal(), continueAfterWitchPoison(), continueAfterDayVote(), continueAfterHunterRevenge(). Dependencies: Game, Lobby, SocketServer, AudioManager. Add integration tests for game flow phases. Must achieve >85% coverage.

- [x] Task 5.3: Read apps/server.bk/src/core/special-scenarios.ts in full. Extend apps/server/src/services/GameFlow.ts to add special scenario detection: checkPostNightScenarios(), checkPostDayVoteScenarios(). Return SpecialScenario type ('hunter-revenge' | 'lover-suicide' | 'hunter-lover' | null). Integrate special scenario checks into phase execution - trigger hunter revenge when hunter dies, trigger lover suicide when lover dies, handle hunter-lover complex scenario. Add tests for all special scenarios. Must achieve >85% coverage.

## Phase 6: SocketHandlers Service (Event Wiring)

- [x] Task 6.1: Read apps/server.bk/src/server/server-events.ts socket event registration in full. Create apps/server/src/services/SocketHandlers.ts as Effect.Service with setupHandlers() method. Wire socket events: 'player:join' → lobby.addPlayer + emit player data, 'admin:start-game' → gameFlow.startGame, 'cupid:lovers-pick' → game.setLovers + gameFlow.continueAfterCupid. Dependencies: SocketServer, Lobby, LobbyConfig, Game, GameFlow. No unit tests needed (wiring layer), but ensure all events from server-events.ts are registered.

- [x] Task 6.2: Read apps/server.bk/src/server/events-actions.ts game phase event handlers in full. Extend apps/server/src/services/SocketHandlers.ts to add game phase events: 'werewolf:player-voted' → game.handleWerewolfVote + check agreement + gameFlow.continueAfterWerewolfVote, 'witch:healed-player' → game.witchHeal + gameFlow.continueAfterWitchHeal, 'witch:poisoned-player' → game.witchPoison + gameFlow.continueAfterWitchPoison, 'day:player-voted' → game.handleDayVote + check completion + gameFlow.continueAfterDayVote, 'hunter:killed-player' → game.killPlayer + gameFlow.continueAfterHunterRevenge. All event handlers must include error handling with Effect.catchAll.

## Phase 7: Layer Composition & Integration

- [x] Task 7.1: Read apps/server.bk/src/index.ts server startup in full. Update apps/server/src/index.ts to compose ALL service layers in correct dependency order. Base infrastructure: HttpServer.Live + LobbyConfig.Live. Socket layer: SocketServer.Default. Domain layer: Lobby.Default + AudioManager.Default (parallel). Game layer: Game.Default. Orchestration layer: GameFlow.Default + SocketHandlers.Default (parallel). Use Layer.mergeAll and Layer.provideMerge to build mainLayer. Call setupHandlers() in main program. Ensure server starts successfully.

- [x] Task 7.2: Create apps/server/src/services/__tests__/integration.test.ts with end-to-end integration test. Test complete game flow: lobby → role assignment → cupid → werewolf voting → day voting → winner detection. Use all Test layers (AudioManager.Test, SocketServer.Test mock). Verify game state transitions correctly through all phases. Test at minimum: villagers win scenario, werewolves win scenario. Must prove all services integrate correctly.

## Phase 8: Cleanup & Documentation

- [ ] Task 8.1: Create apps/server/src/services/__tests__/test-utils.ts with reusable test utilities. Include: LobbyTest layer (Lobby + LobbyConfig.Test), GameTest layer (Game + LobbyTest), makeSocketCapture() returning mock SocketServer with emission capture array, makeAudioCapture() returning mock AudioManager with call recording array. Refactor existing tests to use these utilities where applicable.

- [ ] Task 8.2: Add comprehensive JSDoc comments to ALL public methods in Game.ts, GameFlow.ts, Lobby.ts interfaces. Document parameters, return types, thrown errors, service dependencies. Create apps/server/README.md documenting: architecture overview, service dependency graph, layer composition order, how to run tests, how to add new services. Include diagram from architecture document.

- [ ] Task 8.3: Remove apps/server.bk/ directory entirely after verifying all functionality migrated. Run full test suite: `bun test apps/server/src/services/` and verify >85% overall coverage. Run lint: `npm run lint` and fix all issues. Verify server starts and dashboard can connect. Create git commit: "feat: complete Effect TS migration".

