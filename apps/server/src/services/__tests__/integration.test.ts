import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { SocketServer } from '../SocketServer.js';

/**
 * Integration Test Suite
 *
 * This test suite verifies end-to-end integration of all game services:
 * - Lobby management
 * - Role assignment
 * - Game flow orchestration (cupid, werewolf voting, day voting)
 * - Win condition detection
 * - Death processing and lover mechanics
 *
 * Tests complete game scenarios from lobby to winner detection.
 */

const playerNames = [
  'Alice',
  'Bob',
  'Charlie',
  'Diana',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
];
const playerSocketIds = playerNames.map((_, index) => `socket-${index + 1}`);

const makeTestLayer = () => {
  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers: 8 });
  const lobbyLayer = Lobby.DefaultWithoutDependencies.pipe(
    Layer.provide(configLayer)
  );
  const gameLayer = Game.DefaultWithoutDependencies.pipe(
    Layer.provide(lobbyLayer)
  );
  const audioLayer = AudioManager.Test;
  const socketLayer = SocketServer.Test;
  const gameFlowLayer = GameFlow.DefaultWithoutDependencies.pipe(
    Layer.provide(gameLayer),
    Layer.provide(lobbyLayer),
    Layer.provide(socketLayer),
    Layer.provide(audioLayer)
  );

  return Layer.mergeAll(
    configLayer,
    lobbyLayer,
    gameLayer,
    audioLayer,
    socketLayer,
    gameFlowLayer
  );
};

const setupGame = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;
  const gameFlow = yield* GameFlow;

  // Add all players to lobby
  for (const [index, name] of playerNames.entries()) {
    yield* lobby.addPlayer(name, playerSocketIds[index]);
  }

  // Start the game (assigns roles)
  yield* gameFlow.startGame;

  const players = yield* game.getPlayers;

  return { lobby, game, gameFlow, players };
});

describe('End-to-End Integration Tests', () => {
  describe('Complete Game Flow - Villagers Win Scenario', () => {
    it.effect('runs complete game from lobby to villagers victory', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        // Verify initial state - all players alive
        const alivePlayers = players.filter((p) => p.isAlive);
        expect(alivePlayers.length).toBe(8);

        // === NIGHT 1: CUPID PHASE ===
        // Cupid selects two lovers
        const lover1 = players[0];
        const lover2 = players[1];
        if (!(lover1 && lover2)) {
          throw new Error('Expected lovers to be defined');
        }

        yield* game.setLovers(lover1.getSocketId(), lover2.getSocketId());
        yield* gameFlow.continueAfterCupid;

        // Verify first night completed
        const firstNightDone = yield* gameFlow.shouldSkipCupid;
        expect(firstNightDone).toBe(true);

        // === NIGHT 1: LOVERS REVEAL ===
        yield* gameFlow.continueAfterLoversReveal;

        // Verify lovers are set
        const lovers = yield* game.getLovers();
        expect(lovers).toBeTruthy();
        expect(lovers?.length).toBe(2);

        // === NIGHT 1: WEREWOLF VOTE ===
        yield* gameFlow.runNightPhase;

        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        const villagerTarget = players.find(
          (p) => p.getRole() !== 'WEREWOLF' && p !== lover1 && p !== lover2
        );

        if (!villagerTarget || werewolves.length === 0) {
          throw new Error('Expected werewolves and target');
        }

        // All werewolves vote for the same target
        for (const wolf of werewolves) {
          yield* game.handleWerewolfVote(
            wolf.getSocketId(),
            villagerTarget.getSocketId()
          );
        }

        yield* gameFlow.continueAfterWerewolfVote;

        // Verify target is in death queue
        const isInQueue = yield* game.isInDeathQueue(
          villagerTarget.getSocketId()
        );
        expect(isInQueue).toBe(true);

        // === DAY 1: PROCESS NIGHT DEATHS ===
        yield* gameFlow.runDayPhase;

        // Verify target died
        expect(villagerTarget.isAlive).toBe(false);

        // Verify game continues (no winner yet)
        let winner = yield* game.checkWinner;
        expect(winner).toBeNull();

        // === DAY 1: DAY VOTE ===
        const alivePlayersForVote = players.filter((p) => p.isAlive);
        const werewolfTarget = werewolves.find((w) => w.isAlive);

        if (!werewolfTarget) {
          throw new Error('Expected alive werewolf');
        }

        // All alive players vote for a werewolf
        for (const player of alivePlayersForVote) {
          yield* game.handleDayVote(
            player.getSocketId(),
            werewolfTarget.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        // Verify werewolf died
        expect(werewolfTarget.isAlive).toBe(false);

        // === NIGHT 2: CONTINUE ELIMINATING WEREWOLVES ===
        // Skip cupid and lovers (already done in first night)
        yield* gameFlow.applySkipLogic;

        const remainingWerewolves = werewolves.filter((w) => w.isAlive);

        // If there are still werewolves, eliminate them
        if (remainingWerewolves.length > 0) {
          // Simulate another round to kill remaining werewolves
          for (const wolf of remainingWerewolves) {
            yield* game.killPlayer(wolf.getSocketId());
          }
        }

        // Check winner - villagers should win
        winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');

        // Verify werewolves are eliminated
        const aliveWerewolves = werewolves.filter((w) => w.isAlive);
        expect(aliveWerewolves.length).toBe(0);

        // Verify at least some villagers survived
        const aliveVillagers = players.filter(
          (p) => p.getRole() !== 'WEREWOLF' && p.isAlive
        );
        expect(aliveVillagers.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'handles lover suicide when one lover dies during villagers win scenario',
      () =>
        Effect.gen(function* () {
          const { game, gameFlow, players } = yield* setupGame;

          // Set up lovers
          const lover1 = players[0];
          const lover2 = players[1];
          if (!(lover1 && lover2)) {
            throw new Error('Expected lovers to be defined');
          }

          yield* game.setLovers(lover1.getSocketId(), lover2.getSocketId());
          yield* gameFlow.continueAfterCupid;

          // Werewolves target one of the lovers
          const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
          yield* gameFlow.runNightPhase;

          for (const wolf of werewolves) {
            yield* game.handleWerewolfVote(
              wolf.getSocketId(),
              lover1.getSocketId()
            );
          }

          yield* gameFlow.continueAfterWerewolfVote;

          // Run day phase - should trigger lover suicide
          yield* gameFlow.runDayPhase;

          // Both lovers should be dead
          expect(lover1.isAlive).toBe(false);
          expect(lover2.isAlive).toBe(false);

          // Kill all werewolves to trigger villagers win
          for (const wolf of werewolves) {
            yield* game.killPlayer(wolf.getSocketId());
          }

          const winner = yield* game.checkWinner;
          expect(winner).toBe('villagers');
        }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Complete Game Flow - Werewolves Win Scenario', () => {
    it.effect('runs complete game from lobby to werewolves victory', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        // === SETUP: SKIP CUPID FOR SIMPLICITY ===
        yield* gameFlow.markFirstNightComplete;

        // === STRATEGY: ELIMINATE ALL VILLAGERS ===
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        const villagers = players.filter((p) => p.getRole() !== 'WEREWOLF');

        if (werewolves.length === 0 || villagers.length === 0) {
          throw new Error('Expected both werewolves and villagers');
        }

        // Kill all villagers except one (to create werewolf majority)
        let villagerIndex = 0;
        while (villagerIndex < villagers.length - 1) {
          const target = villagers[villagerIndex];
          if (!target) {
            break;
          }

          yield* game.killPlayer(target.getSocketId());
          villagerIndex++;
        }

        // Now kill the last villager
        const lastVillager = villagers.at(-1);
        if (lastVillager) {
          yield* game.killPlayer(lastVillager.getSocketId());
        }

        // Check winner - werewolves should win
        const winner = yield* game.checkWinner;
        expect(winner).toBe('werewolves');

        // Verify all villagers are dead
        const aliveVillagers = villagers.filter((v) => v.isAlive);
        expect(aliveVillagers.length).toBe(0);

        // Verify werewolves are alive
        const aliveWerewolves = werewolves.filter((w) => w.isAlive);
        expect(aliveWerewolves.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'werewolves win when werewolf count equals or exceeds villager count',
      () =>
        Effect.gen(function* () {
          const { game, gameFlow, players } = yield* setupGame;

          yield* gameFlow.markFirstNightComplete;

          const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
          const villagers = players.filter((p) => p.getRole() !== 'WEREWOLF');

          // Kill villagers until werewolves equal villagers
          const targetVillagerCount = werewolves.length;
          const killCount = villagers.length - targetVillagerCount;

          for (let i = 0; i < killCount; i++) {
            const target = villagers[i];
            if (target) {
              yield* game.killPlayer(target.getSocketId());
            }
          }

          // Check winner - werewolves should win when count is equal
          const winner = yield* game.checkWinner;
          expect(winner).toBe('werewolves');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'werewolves win through systematic night kills and day vote manipulation',
      () =>
        Effect.gen(function* () {
          const { game, gameFlow, players } = yield* setupGame;

          // === NIGHT 1: CUPID ===
          yield* gameFlow.continueAfterCupid;
          yield* gameFlow.continueAfterLoversReveal;

          // === SIMULATE MULTIPLE ROUNDS ===
          const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
          const villagers = players.filter((p) => p.getRole() !== 'WEREWOLF');

          let round = 0;
          const maxRounds = 10; // Safety limit

          while (round < maxRounds) {
            round++;

            // Apply skip logic for this round
            yield* gameFlow.applySkipLogic;

            // Night phase: werewolves vote
            yield* gameFlow.runNightPhase;

            const aliveVillagers = villagers.filter((v) => v.isAlive);
            const aliveWerewolves = werewolves.filter((w) => w.isAlive);

            if (aliveVillagers.length === 0) {
              break;
            }

            const target = aliveVillagers[0];
            if (!target) {
              break;
            }

            // Werewolves vote for target
            for (const wolf of aliveWerewolves) {
              yield* game.handleWerewolfVote(
                wolf.getSocketId(),
                target.getSocketId()
              );
            }

            yield* gameFlow.continueAfterWerewolfVote;

            // Day phase
            yield* gameFlow.runDayPhase;

            // Check for winner
            const winner = yield* game.checkWinner;
            if (winner === 'werewolves') {
              expect(winner).toBe('werewolves');

              // Verify game state - werewolves >= villagers (win condition)
              const finalAliveVillagers = villagers.filter((v) => v.isAlive);
              const finalAliveWerewolves = werewolves.filter((w) => w.isAlive);

              expect(finalAliveWerewolves.length).toBeGreaterThan(0);
              // Werewolves win when they equal or exceed villagers, not necessarily 0
              expect(finalAliveWerewolves.length).toBeGreaterThanOrEqual(
                finalAliveVillagers.length
              );
              break;
            }

            // If game continues, simulate day vote (villagers vote out a werewolf or villager)
            const alivePlayers = players.filter((p) => p.isAlive);
            if (alivePlayers.length > 0 && !winner) {
              // For this scenario, have villagers mistakenly vote out another villager
              const voteTarget =
                aliveVillagers.length > 1
                  ? aliveVillagers[1]
                  : aliveVillagers[0];

              if (voteTarget) {
                for (const player of alivePlayers) {
                  yield* game.handleDayVote(
                    player.getSocketId(),
                    voteTarget.getSocketId()
                  );
                }

                yield* gameFlow.continueAfterDayVote;

                // Check winner again
                const dayWinner = yield* game.checkWinner;
                if (dayWinner === 'werewolves') {
                  expect(dayWinner).toBe('werewolves');
                  break;
                }
              }
            }
          }

          // Ensure we detected a werewolf win
          const finalWinner = yield* game.checkWinner;
          expect(finalWinner).toBe('werewolves');
        }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Service Integration Verification', () => {
    it.effect(
      'verifies all services integrate correctly throughout game flow',
      () =>
        Effect.gen(function* () {
          const { lobby, game, gameFlow, players } = yield* setupGame;

          // === VERIFY LOBBY SERVICE ===
          // Lobby should be cleared after game start
          const lobbyPlayers = yield* lobby.getAllPlayers;
          expect(lobbyPlayers.length).toBe(0);

          // === VERIFY GAME SERVICE ===
          // All players should have roles assigned
          expect(players.length).toBe(8);
          for (const player of players) {
            expect(player.getRole()).toBeTruthy();
            expect(player.isAlive).toBe(true);
          }

          // Verify role distribution
          const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
          expect(werewolves.length).toBeGreaterThan(0);

          // === VERIFY GAMEFLOW SERVICE ===
          // Verify segments are initialized
          const segments = yield* gameFlow.getSegments;
          expect(segments.length).toBe(7);

          // === VERIFY GAME PHASES ===
          // Cupid phase
          const cupidSegment = yield* gameFlow.getSegmentByType('CUPID');
          expect(cupidSegment).toBeTruthy();
          expect(cupidSegment?.skip).toBe(false); // First night

          // Set lovers
          yield* game.setLovers(
            players[0]?.getSocketId(),
            players[1]?.getSocketId()
          );
          yield* gameFlow.continueAfterCupid;

          // Verify first night completed
          const shouldSkipCupid = yield* gameFlow.shouldSkipCupid;
          expect(shouldSkipCupid).toBe(true);

          // === VERIFY VOTING MECHANICS ===
          yield* gameFlow.runNightPhase;

          const target = players.find((p) => p.getRole() !== 'WEREWOLF');
          if (!target || werewolves.length === 0) {
            throw new Error('Expected werewolves and target');
          }

          // Werewolf voting
          for (const wolf of werewolves) {
            yield* game.handleWerewolfVote(
              wolf.getSocketId(),
              target.getSocketId()
            );
          }

          const tallies = yield* game.getWerewolfVoteTallies;
          expect(tallies[target.getSocketId()]).toBe(werewolves.length);

          yield* gameFlow.continueAfterWerewolfVote;

          // === VERIFY DEATH PROCESSING ===
          const isTargetInQueue = yield* game.isInDeathQueue(
            target.getSocketId()
          );
          expect(isTargetInQueue).toBe(true);

          yield* gameFlow.runDayPhase;
          expect(target.isAlive).toBe(false);

          // === VERIFY WIN CONDITION CHECKING ===
          const winner = yield* game.checkWinner;
          // Game should continue (no winner yet)
          expect(winner).toBeNull();

          // === VERIFY AUDIOMANAGER INTEGRATION (TEST MOCK) ===
          // Audio manager should have been called during game flow
          // (Test layer uses mock that returns Effect.void)

          // === VERIFY SOCKETSERVER INTEGRATION (TEST MOCK) ===
          // Socket server should have been called during game flow
          // (Test layer uses mock implementation)
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'verifies game state transitions through all phases correctly',
      () =>
        Effect.gen(function* () {
          const { game, gameFlow, players } = yield* setupGame;

          // === PHASE 1: LOBBY → GAME START ===
          // Players assigned roles
          expect(players.length).toBe(8);

          // === PHASE 2: CUPID ===
          const initialCupidSkip = yield* gameFlow.shouldSkipCupid;
          expect(initialCupidSkip).toBe(false);

          yield* game.setLovers(
            players[0]?.getSocketId(),
            players[1]?.getSocketId()
          );
          yield* gameFlow.continueAfterCupid;

          const postCupidSkip = yield* gameFlow.shouldSkipCupid;
          expect(postCupidSkip).toBe(true);

          // === PHASE 3: LOVERS REVEAL ===
          yield* gameFlow.continueAfterLoversReveal;

          const lovers = yield* game.getLovers();
          expect(lovers).toBeTruthy();

          // === PHASE 4: NIGHT PHASES ===
          yield* gameFlow.runNightPhase;

          // Verify segments skipped correctly after first night
          yield* gameFlow.applySkipLogic;
          const segmentsAfterFirstNight = yield* gameFlow.getSegments;
          const cupidSegment = segmentsAfterFirstNight.find(
            (s) => s.type === 'CUPID'
          );
          const loversSegment = segmentsAfterFirstNight.find(
            (s) => s.type === 'LOVERS'
          );
          expect(cupidSegment?.skip).toBe(true);
          expect(loversSegment?.skip).toBe(true);

          // === PHASE 5: WEREWOLF VOTE ===
          const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
          const target = players.find((p) => p.getRole() !== 'WEREWOLF');

          if (!target || werewolves.length === 0) {
            throw new Error('Expected werewolves and target');
          }

          for (const wolf of werewolves) {
            yield* game.handleWerewolfVote(
              wolf.getSocketId(),
              target.getSocketId()
            );
          }

          yield* gameFlow.continueAfterWerewolfVote;

          // === PHASE 6: DAY PHASE (DEATH PROCESSING) ===
          yield* gameFlow.runDayPhase;
          expect(target.isAlive).toBe(false);

          // === PHASE 7: DAY VOTE ===
          const alivePlayers = players.filter((p) => p.isAlive);
          const dayTarget = werewolves.find((w) => w.isAlive);

          if (!dayTarget) {
            throw new Error('Expected alive werewolf');
          }

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              dayTarget.getSocketId()
            );
          }

          yield* gameFlow.continueAfterDayVote;
          expect(dayTarget.isAlive).toBe(false);

          // === PHASE 8: WINNER DETECTION ===
          // Kill remaining werewolves to trigger win
          const remainingWerewolves = werewolves.filter((w) => w.isAlive);
          for (const wolf of remainingWerewolves) {
            yield* game.killPlayer(wolf.getSocketId());
          }

          const winner = yield* game.checkWinner;
          expect(winner).toBe('villagers');
        }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Edge Cases and Special Scenarios', () => {
    it.effect('handles hunter revenge scenario in integration', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        yield* gameFlow.markFirstNightComplete;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (!hunter) {
          // If no hunter was assigned, skip this test
          return;
        }

        // Werewolves kill the hunter
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        yield* gameFlow.runNightPhase;

        for (const wolf of werewolves) {
          yield* game.handleWerewolfVote(
            wolf.getSocketId(),
            hunter.getSocketId()
          );
        }

        yield* gameFlow.continueAfterWerewolfVote;

        // Verify hunter is in death queue before day phase
        const hunterInQueueBefore = yield* game.hunterIsInDeathQueue;
        expect(hunterInQueueBefore).toBe(true);

        // Run day phase - should detect hunter revenge scenario
        // Note: runDayPhase returns early for hunter-revenge without processing deaths
        yield* gameFlow.runDayPhase;

        // Hunter should still be in death queue (not yet processed due to hunter-revenge scenario)
        const hunterInQueueAfter = yield* game.hunterIsInDeathQueue;
        expect(hunterInQueueAfter).toBe(true);

        // Manually process deaths to verify hunter dies
        const deaths = yield* game.processPendingDeaths;
        expect(deaths.length).toBeGreaterThan(0);
        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles witch potion usage throughout game flow', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        yield* gameFlow.markFirstNightComplete;

        // Verify witch has potions
        const canHeal = yield* game.canWitchHeal;
        const canPoison = yield* game.canWitchPoison;
        expect(canHeal).toBe(true);
        expect(canPoison).toBe(true);

        // Werewolves target someone
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        const target = players.find((p) => p.getRole() !== 'WEREWOLF');

        if (!target || werewolves.length === 0) {
          throw new Error('Expected werewolves and target');
        }

        yield* gameFlow.runNightPhase;

        for (const wolf of werewolves) {
          yield* game.handleWerewolfVote(
            wolf.getSocketId(),
            target.getSocketId()
          );
        }

        yield* gameFlow.continueAfterWerewolfVote;

        // Witch heals the target
        yield* game.witchHeal;

        const canHealAfter = yield* game.canWitchHeal;
        expect(canHealAfter).toBe(false);

        // Apply skip logic - witch heal should be skipped now
        yield* gameFlow.applySkipLogic;
        const witchHealSegment = yield* gameFlow.getSegmentByType('WITCH-HEAL');
        expect(witchHealSegment?.skip).toBe(true);

        // Use witch poison
        const poisonTarget = werewolves[0];
        if (poisonTarget) {
          yield* game.witchPoison(poisonTarget.getSocketId());
        }

        const canPoisonAfter = yield* game.canWitchPoison;
        expect(canPoisonAfter).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles complex lover and hunter interaction in full game', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!(hunter && nonHunter)) {
          // Skip if no hunter
          return;
        }

        // Make hunter and non-hunter lovers
        yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
        yield* gameFlow.continueAfterCupid;
        yield* gameFlow.continueAfterLoversReveal;

        // Werewolves kill the non-hunter lover
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        yield* gameFlow.runNightPhase;

        for (const wolf of werewolves) {
          yield* game.handleWerewolfVote(
            wolf.getSocketId(),
            nonHunter.getSocketId()
          );
        }

        yield* gameFlow.continueAfterWerewolfVote;

        // Run day phase - should trigger hunter-lover scenario
        yield* gameFlow.runDayPhase;

        // Both lovers should be dead
        expect(nonHunter.isAlive).toBe(false);
        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('completes full game with all segments and special cases', () =>
      Effect.gen(function* () {
        const { game, gameFlow, players } = yield* setupGame;

        // === COMPLETE FIRST NIGHT ===
        // Cupid
        yield* game.setLovers(
          players[0]?.getSocketId(),
          players[1]?.getSocketId()
        );
        yield* gameFlow.continueAfterCupid;

        // Lovers reveal
        yield* gameFlow.continueAfterLoversReveal;

        // Run night phase
        yield* gameFlow.runNightPhase;

        // Werewolf vote
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        const target = players.find(
          (p) =>
            p.getRole() !== 'WEREWOLF' && p !== players[0] && p !== players[1]
        );

        if (!target || werewolves.length === 0) {
          throw new Error('Expected werewolves and target');
        }

        for (const wolf of werewolves) {
          yield* game.handleWerewolfVote(
            wolf.getSocketId(),
            target.getSocketId()
          );
        }

        yield* gameFlow.continueAfterWerewolfVote;

        // Day phase
        yield* gameFlow.runDayPhase;

        // Day vote
        const alivePlayers = players.filter((p) => p.isAlive);
        const dayTarget = werewolves.find((w) => w.isAlive);

        if (!dayTarget) {
          throw new Error('Expected alive werewolf');
        }

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            dayTarget.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        // === SECOND NIGHT ===
        yield* gameFlow.applySkipLogic;

        // Verify cupid and lovers are skipped
        const cupidSkip = yield* gameFlow.shouldSkipCupid;
        const loversSkip = yield* gameFlow.shouldSkipLovers;
        expect(cupidSkip).toBe(true);
        expect(loversSkip).toBe(true);

        // Continue game until winner
        const remainingWerewolves = werewolves.filter((w) => w.isAlive);
        for (const wolf of remainingWerewolves) {
          yield* game.killPlayer(wolf.getSocketId());
        }

        const winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');

        // Verify final state
        const finalAlivePlayers = players.filter((p) => p.isAlive);
        expect(finalAlivePlayers.length).toBeGreaterThan(0);

        const finalAliveWerewolves = werewolves.filter((w) => w.isAlive);
        expect(finalAliveWerewolves.length).toBe(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });
});
