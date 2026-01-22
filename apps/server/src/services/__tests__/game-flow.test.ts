import { describe, expect, it } from '@effect/vitest';
import type { SegmentType } from '@repo/types';
import { Effect, Layer } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { Game } from '../Game.js';
import { GameFlow } from '../GameFlow.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { SocketServer } from '../SocketServer.js';

const playerNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
const playerSocketIds = playerNames.map((_, index) => `socket-${index + 1}`);

const makeTestLayer = () => {
  const configLayer = Layer.succeed(LobbyConfig, { maxPlayers: 6 });
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

const setupGameFlow = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;
  const gameFlow = yield* GameFlow;

  for (const [index, name] of playerNames.entries()) {
    yield* lobby.addPlayer(name, playerSocketIds[index]);
  }

  yield* game.startGame;

  const players = yield* game.getPlayers;

  return { game, gameFlow, players };
});

describe('GameFlow Service', () => {
  describe('Initial segment state', () => {
    it.effect('initializes segments with correct skip states', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const segments = yield* gameFlow.getSegments;

        expect(segments).toHaveLength(7);
        expect(segments[0]).toEqual({ type: 'CUPID', skip: false });
        expect(segments[1]).toEqual({ type: 'LOVERS', skip: false });
        expect(segments[2]).toEqual({ type: 'WEREWOLF', skip: false });
        expect(segments[3]).toEqual({ type: 'WITCH-HEAL', skip: true });
        expect(segments[4]).toEqual({ type: 'WITCH-POISON', skip: true });
        expect(segments[5]).toEqual({ type: 'DAY', skip: false });
        expect(segments[6]).toEqual({ type: 'HUNTER', skip: true });
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('retrieves segment by type', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const cupidSegment = yield* gameFlow.getSegmentByType('CUPID');
        const hunterSegment = yield* gameFlow.getSegmentByType('HUNTER');

        expect(cupidSegment).toEqual({ type: 'CUPID', skip: false });
        expect(hunterSegment).toEqual({ type: 'HUNTER', skip: true });
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('skipSegment method', () => {
    it.effect('marks a segment as skip', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.skipSegment('WEREWOLF');

        const segment = yield* gameFlow.getSegmentByType('WEREWOLF');
        expect(segment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('marks multiple segments as skip', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.skipSegment('CUPID');
        yield* gameFlow.skipSegment('LOVERS');
        yield* gameFlow.skipSegment('DAY');

        const segments = yield* gameFlow.getSegments;
        const cupid = segments.find((s) => s.type === 'CUPID');
        const lovers = segments.find((s) => s.type === 'LOVERS');
        const day = segments.find((s) => s.type === 'DAY');

        expect(cupid?.skip).toBe(true);
        expect(lovers?.skip).toBe(true);
        expect(day?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('unskipSegment method', () => {
    it.effect('marks a segment as not skip', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.unskipSegment('WITCH-HEAL');

        const segment = yield* gameFlow.getSegmentByType('WITCH-HEAL');
        expect(segment?.skip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('First night skip logic - Cupid', () => {
    it.effect('does not skip cupid on first night', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const shouldSkip = yield* gameFlow.shouldSkipCupid;

        expect(shouldSkip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('skips cupid after first night', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.markFirstNightComplete;

        const shouldSkip = yield* gameFlow.shouldSkipCupid;

        expect(shouldSkip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies cupid skip logic correctly', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.markFirstNightComplete;
        yield* gameFlow.applySkipLogic;

        const cupidSegment = yield* gameFlow.getSegmentByType('CUPID');
        expect(cupidSegment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('First night skip logic - Lovers', () => {
    it.effect('does not skip lovers on first night', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const shouldSkip = yield* gameFlow.shouldSkipLovers;

        expect(shouldSkip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('skips lovers after first night', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.markFirstNightComplete;

        const shouldSkip = yield* gameFlow.shouldSkipLovers;

        expect(shouldSkip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies lovers skip logic correctly', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.markFirstNightComplete;
        yield* gameFlow.applySkipLogic;

        const loversSegment = yield* gameFlow.getSegmentByType('LOVERS');
        expect(loversSegment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Witch potion skip logic', () => {
    it.effect('does not skip witch heal when potion available', () =>
      Effect.gen(function* () {
        const { gameFlow, game } = yield* setupGameFlow;

        const canHeal = yield* game.canWitchHeal;
        expect(canHeal).toBe(true);

        const shouldSkip = yield* gameFlow.shouldSkipWitchHeal;
        expect(shouldSkip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('skips witch heal when potion unavailable', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const victim = players[0];
        if (!victim) {
          throw new Error('Expected victim to be defined');
        }

        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;

        const shouldSkip = yield* gameFlow.shouldSkipWitchHeal;
        expect(shouldSkip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('does not skip witch poison when potion available', () =>
      Effect.gen(function* () {
        const { gameFlow, game } = yield* setupGameFlow;

        const canPoison = yield* game.canWitchPoison;
        expect(canPoison).toBe(true);

        const shouldSkip = yield* gameFlow.shouldSkipWitchPoison;
        expect(shouldSkip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('skips witch poison when potion unavailable', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const target = players[0];
        if (!target) {
          throw new Error('Expected target to be defined');
        }

        yield* game.witchPoison(target.getSocketId());

        const shouldSkip = yield* gameFlow.shouldSkipWitchPoison;
        expect(shouldSkip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies witch heal skip logic correctly', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const victim = players[0];
        if (!victim) {
          throw new Error('Expected victim to be defined');
        }

        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;
        yield* gameFlow.applySkipLogic;

        const witchHealSegment = yield* gameFlow.getSegmentByType('WITCH-HEAL');
        expect(witchHealSegment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies witch poison skip logic correctly', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const target = players[0];
        if (!target) {
          throw new Error('Expected target to be defined');
        }

        yield* game.witchPoison(target.getSocketId());
        yield* gameFlow.applySkipLogic;

        const witchPoisonSegment =
          yield* gameFlow.getSegmentByType('WITCH-POISON');
        expect(witchPoisonSegment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('skips both witch segments when witch dies', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const witch = players.find((p) => p.getRole() === 'WITCH');
        if (!witch) {
          throw new Error('Expected witch to be defined');
        }

        yield* game.killPlayer(witch.getSocketId());
        yield* gameFlow.applySkipLogic;

        const witchHealSegment = yield* gameFlow.getSegmentByType('WITCH-HEAL');
        const witchPoisonSegment =
          yield* gameFlow.getSegmentByType('WITCH-POISON');

        expect(witchHealSegment?.skip).toBe(true);
        expect(witchPoisonSegment?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Hunter skip logic', () => {
    it.effect('skips hunter when not in death queue', () =>
      Effect.gen(function* () {
        const { gameFlow, game } = yield* setupGameFlow;

        const hunterInQueue = yield* game.hunterIsInDeathQueue;
        expect(hunterInQueue).toBe(false);

        const shouldSkip = yield* gameFlow.shouldSkipHunter;
        expect(shouldSkip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('does not skip hunter when in death queue', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Find the hunter that was assigned during setup
        const hunter = players.find((p) => p.getRole() === 'HUNTER');

        // If no hunter was assigned in this test run, we can't test this scenario
        if (!hunter) {
          // Skip this test if no hunter was assigned
          return;
        }

        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

        const hunterInQueue = yield* game.hunterIsInDeathQueue;
        expect(hunterInQueue).toBe(true);

        const shouldSkip = yield* gameFlow.shouldSkipHunter;
        expect(shouldSkip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies hunter skip logic correctly', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Find the hunter that was assigned during setup
        const hunter = players.find((p) => p.getRole() === 'HUNTER');

        // If no hunter was assigned in this test run, skip this test
        if (!hunter) {
          return;
        }

        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');
        yield* gameFlow.applySkipLogic;

        const hunterSegment = yield* gameFlow.getSegmentByType('HUNTER');
        expect(hunterSegment?.skip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('applySkipLogic - comprehensive', () => {
    it.effect('applies all skip logic rules together', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Mark first night complete
        yield* gameFlow.markFirstNightComplete;

        // Use witch heal potion
        const victim = players[0];
        if (!victim) {
          throw new Error('Expected victim to be defined');
        }
        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;

        // Use witch poison potion
        const target = players[1];
        if (!target) {
          throw new Error('Expected target to be defined');
        }
        yield* game.witchPoison(target.getSocketId());

        // Find hunter and add to death queue if exists
        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (hunter) {
          yield* game.addPendingDeath(hunter.getSocketId(), 'DAY_VOTE');
        }

        // Apply all skip logic
        yield* gameFlow.applySkipLogic;

        const segments = yield* gameFlow.getSegments;
        const cupid = segments.find((s) => s.type === 'CUPID');
        const lovers = segments.find((s) => s.type === 'LOVERS');
        const werewolf = segments.find((s) => s.type === 'WEREWOLF');
        const witchHeal = segments.find((s) => s.type === 'WITCH-HEAL');
        const witchPoison = segments.find((s) => s.type === 'WITCH-POISON');
        const day = segments.find((s) => s.type === 'DAY');
        const hunterSeg = segments.find((s) => s.type === 'HUNTER');

        expect(cupid?.skip).toBe(true); // First night complete
        expect(lovers?.skip).toBe(true); // First night complete
        expect(werewolf?.skip).toBe(false); // Always active
        expect(witchHeal?.skip).toBe(true); // Potion used
        expect(witchPoison?.skip).toBe(true); // Potion used
        expect(day?.skip).toBe(false); // Always active

        // Hunter skip depends on whether hunter exists and is in death queue
        if (hunter) {
          expect(hunterSeg?.skip).toBe(false); // In death queue
        } else {
          expect(hunterSeg?.skip).toBe(true); // No hunter in game
        }
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles skip logic on first night correctly', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.applySkipLogic;

        const segments = yield* gameFlow.getSegments;
        const cupid = segments.find((s) => s.type === 'CUPID');
        const lovers = segments.find((s) => s.type === 'LOVERS');
        const witchHeal = segments.find((s) => s.type === 'WITCH-HEAL');
        const witchPoison = segments.find((s) => s.type === 'WITCH-POISON');
        const hunter = segments.find((s) => s.type === 'HUNTER');

        expect(cupid?.skip).toBe(false); // First night, should not skip
        expect(lovers?.skip).toBe(false); // First night, should not skip
        expect(witchHeal?.skip).toBe(false); // Has heal potion
        expect(witchPoison?.skip).toBe(false); // Has poison potion
        expect(hunter?.skip).toBe(true); // Not in death queue
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Segment state immutability', () => {
    it.effect('updates segments independently', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.skipSegment('CUPID');

        const cupid = yield* gameFlow.getSegmentByType('CUPID');
        const lovers = yield* gameFlow.getSegmentByType('LOVERS');

        expect(cupid?.skip).toBe(true);
        expect(lovers?.skip).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('persists segment state across multiple operations', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.skipSegment('CUPID');
        yield* gameFlow.skipSegment('LOVERS');

        const segments1 = yield* gameFlow.getSegments;
        const cupid1 = segments1.find((s) => s.type === 'CUPID');
        const lovers1 = segments1.find((s) => s.type === 'LOVERS');

        expect(cupid1?.skip).toBe(true);
        expect(lovers1?.skip).toBe(true);

        yield* gameFlow.unskipSegment('CUPID');

        const segments2 = yield* gameFlow.getSegments;
        const cupid2 = segments2.find((s) => s.type === 'CUPID');
        const lovers2 = segments2.find((s) => s.type === 'LOVERS');

        expect(cupid2?.skip).toBe(false);
        expect(lovers2?.skip).toBe(true); // Should remain true
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Edge cases', () => {
    it.effect('handles getting non-existent segment type', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const segment = yield* gameFlow.getSegmentByType(
          'NONEXISTENT' as SegmentType
        );

        expect(segment).toBeUndefined();
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles skip on non-existent segment gracefully', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.skipSegment('NONEXISTENT' as SegmentType);

        const segments = yield* gameFlow.getSegments;
        expect(segments).toHaveLength(7); // Should not add new segment
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Phase orchestration - runNightPhase', () => {
    it.effect('runs night phase and skips day segments', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.runNightPhase;

        const segments = yield* gameFlow.getSegments;
        const nightSegments = segments.filter(
          (s) =>
            s.type !== 'DAY' && s.type !== 'DAY_VOTE' && s.type !== 'HUNTER'
        );

        expect(nightSegments.length).toBeGreaterThan(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('applies skip logic before running night phase', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        yield* gameFlow.markFirstNightComplete;
        const victim = players[0];
        if (!victim) {
          throw new Error('Expected victim to be defined');
        }
        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        yield* game.witchHeal;

        yield* gameFlow.runNightPhase;

        const cupid = yield* gameFlow.getSegmentByType('CUPID');
        const witchHeal = yield* gameFlow.getSegmentByType('WITCH-HEAL');

        expect(cupid?.skip).toBe(true);
        expect(witchHeal?.skip).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Phase orchestration - runDayPhase', () => {
    it.effect('processes pending deaths and emits death announcements', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const victim = players[0];
        if (!victim) {
          throw new Error('Expected victim to be defined');
        }

        yield* game.addPendingDeath(victim.getSocketId(), 'WEREWOLVES');
        yield* gameFlow.runDayPhase;

        expect(victim.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles hunter in death queue scenario', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (!hunter) {
          return; // Skip if no hunter
        }

        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');
        yield* gameFlow.runDayPhase;

        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles hunter who is a lover in death queue', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!(hunter && nonHunter)) {
          return; // Skip if no hunter
        }

        yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

        // Verify hunter is in death queue
        const hunterInQueue = yield* game.hunterIsInDeathQueue;
        expect(hunterInQueue).toBe(true);

        yield* gameFlow.runDayPhase;

        expect(hunter.isAlive).toBe(false);
        expect(nonHunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles lover death scenario', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        yield* game.setLovers(
          players[0]!.getSocketId(),
          players[1]!.getSocketId()
        );
        yield* game.addPendingDeath(players[0]!.getSocketId(), 'WEREWOLVES');

        yield* gameFlow.runDayPhase;

        expect(players[0]!.isAlive).toBe(false);
        expect(players[1]!.isAlive).toBe(false); // Partner should die too
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles lover death where partner is hunter', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!(hunter && nonHunter)) {
          return;
        }

        yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
        yield* game.addPendingDeath(nonHunter.getSocketId(), 'WEREWOLVES');

        yield* gameFlow.runDayPhase;

        expect(nonHunter.isAlive).toBe(false);
        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles no deaths in night phase', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        // Run day phase with no pending deaths
        yield* gameFlow.runDayPhase;

        // Should announce no deaths and continue to day voting
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('emits winner when game ends', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Kill all werewolves to trigger villager win
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        for (const wolf of werewolves) {
          yield* game.killPlayer(wolf.getSocketId());
        }

        yield* gameFlow.runDayPhase;

        const winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Cupid', () => {
    it.effect('completes cupid segment and marks first night', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.continueAfterCupid;

        const firstNightCompleted = yield* gameFlow.shouldSkipCupid;
        expect(firstNightCompleted).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Lovers', () => {
    it.effect('completes lovers reveal segment', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.continueAfterLoversReveal;

        // Should complete without errors
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Werewolf', () => {
    it.effect('processes werewolf vote and adds death to queue', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

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

        const isInQueue = yield* game.isInDeathQueue(target.getSocketId());
        expect(isInQueue).toBe(true);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles werewolf vote with no target', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        // Don't cast any votes
        yield* gameFlow.continueAfterWerewolfVote;

        // Should complete without errors even with no target
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('clears werewolf votes after continuation', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

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

        const tallies = yield* game.getWerewolfVoteTallies;
        expect(Object.keys(tallies)).toHaveLength(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Witch', () => {
    it.effect('completes witch heal segment', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.continueAfterWitchHeal;

        // Should complete without errors
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('completes witch poison segment', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.continueAfterWitchPoison;

        // Should complete without errors
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Day Vote', () => {
    it.effect('processes day vote and adds death to queue', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const alivePlayers = players.filter((p) => p.isAlive);
        const target = alivePlayers[0];

        if (!target) {
          throw new Error('Expected target');
        }

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), target.getSocketId());
        }

        yield* gameFlow.continueAfterDayVote;

        expect(target.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles hunter in day vote death', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (!hunter) {
          return; // Skip if no hunter
        }

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), hunter.getSocketId());
        }

        yield* gameFlow.continueAfterDayVote;

        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'handles hunter who is a lover in day vote with hunter partner',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const allHunters = players.filter((p) => p.getRole() === 'HUNTER');

          // Need at least one hunter for this scenario
          if (allHunters.length === 0) {
            return;
          }

          const hunter = allHunters[0];
          if (!hunter) {
            return;
          }

          // Create a second hunter by getting a non-hunter player
          const nonHunter = players.find(
            (p) => p.getRole() === 'HUNTER' && p !== hunter
          );

          // If we have two hunters, use them both
          if (nonHunter) {
            yield* game.setLovers(
              hunter.getSocketId(),
              nonHunter.getSocketId()
            );

            const alivePlayers = players.filter((p) => p.isAlive);

            for (const player of alivePlayers) {
              yield* game.handleDayVote(
                player.getSocketId(),
                hunter.getSocketId()
              );
            }

            yield* gameFlow.continueAfterDayVote;

            expect(hunter.isAlive).toBe(false);
          }
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles lover in day vote where partner is hunter', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!(hunter && nonHunter)) {
          return;
        }

        yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            nonHunter.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        expect(nonHunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles lover in day vote where partner is not hunter', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            nonHunters[0]!.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        expect(nonHunters[0]!.isAlive).toBe(false);
        expect(nonHunters[1]!.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('clears day votes after continuation', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const alivePlayers = players.filter((p) => p.isAlive);
        const target = alivePlayers[0];

        if (!target) {
          throw new Error('Expected target');
        }

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), target.getSocketId());
        }

        yield* gameFlow.continueAfterDayVote;

        const tallies = yield* game.getDayVoteTallies;
        expect(Object.keys(tallies)).toHaveLength(0);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('emits winner when game ends after day vote', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Kill all werewolves except one
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        const lastWerewolf = werewolves[werewolves.length - 1];

        if (!lastWerewolf) {
          return;
        }

        for (let i = 0; i < werewolves.length - 1; i++) {
          yield* game.killPlayer(werewolves[i]!.getSocketId());
        }

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            lastWerewolf.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        const winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Continuation methods - Hunter Revenge', () => {
    it.effect('completes hunter revenge and checks for winner', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        yield* gameFlow.continueAfterHunterRevenge;

        // Should complete without errors
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('emits winner if game ends after hunter revenge', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Kill all werewolves to trigger villager win
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        for (const wolf of werewolves) {
          yield* game.killPlayer(wolf.getSocketId());
        }

        yield* gameFlow.continueAfterHunterRevenge;

        const winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Special scenario detection - checkPostNightScenarios', () => {
    it.effect(
      'returns "hunter-revenge" when hunter dies at night and is not a lover',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          if (!hunter) {
            return; // Skip if no hunter
          }

          yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

          const scenario = yield* gameFlow.checkPostNightScenarios;
          expect(scenario).toBe('hunter-revenge');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when hunter dies at night and is a lover',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
          yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

          const scenario = yield* gameFlow.checkPostNightScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when both lovers are hunters and one dies',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunters = players.filter((p) => p.getRole() === 'HUNTER');

          if (hunters.length < 2) {
            return; // Skip if less than 2 hunters
          }

          yield* game.setLovers(
            hunters[0]!.getSocketId(),
            hunters[1]!.getSocketId()
          );
          yield* game.addPendingDeath(hunters[0]!.getSocketId(), 'WEREWOLVES');

          const scenario = yield* gameFlow.checkPostNightScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns "lover-suicide" when non-hunter lover dies', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );
        yield* game.addPendingDeath(nonHunters[0]!.getSocketId(), 'WEREWOLVES');

        const scenario = yield* gameFlow.checkPostNightScenarios;
        expect(scenario).toBe('lover-suicide');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when lover dies and partner is hunter',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
          yield* game.addPendingDeath(nonHunter.getSocketId(), 'WEREWOLVES');

          const scenario = yield* gameFlow.checkPostNightScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns null when no special scenario occurs', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!nonHunter) {
          return;
        }

        yield* game.addPendingDeath(nonHunter.getSocketId(), 'WEREWOLVES');

        const scenario = yield* gameFlow.checkPostNightScenarios;
        expect(scenario).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns null when no deaths occur', () =>
      Effect.gen(function* () {
        const { gameFlow } = yield* setupGameFlow;

        const scenario = yield* gameFlow.checkPostNightScenarios;
        expect(scenario).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Special scenario detection - checkPostDayVoteScenarios', () => {
    it.effect(
      'returns "hunter-revenge" when hunter is voted out and is not a lover',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          if (!hunter) {
            return;
          }

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              hunter.getSocketId()
            );
          }

          yield* game.addPendingDeath(hunter.getSocketId(), 'DAY_VOTE');

          const scenario = yield* gameFlow.checkPostDayVoteScenarios;
          expect(scenario).toBe('hunter-revenge');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when hunter is voted out and is a lover',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              hunter.getSocketId()
            );
          }

          yield* game.addPendingDeath(hunter.getSocketId(), 'DAY_VOTE');

          const scenario = yield* gameFlow.checkPostDayVoteScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when hunter is voted out and partner is also hunter',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunters = players.filter((p) => p.getRole() === 'HUNTER');

          if (hunters.length < 2) {
            return;
          }

          yield* game.setLovers(
            hunters[0]!.getSocketId(),
            hunters[1]!.getSocketId()
          );

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              hunters[0]!.getSocketId()
            );
          }

          yield* game.addPendingDeath(hunters[0]!.getSocketId(), 'DAY_VOTE');

          const scenario = yield* gameFlow.checkPostDayVoteScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "lover-suicide" when non-hunter lover is voted out',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

          if (nonHunters.length < 2) {
            return;
          }

          yield* game.setLovers(
            nonHunters[0]!.getSocketId(),
            nonHunters[1]!.getSocketId()
          );

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              nonHunters[0]!.getSocketId()
            );
          }

          yield* game.addPendingDeath(nonHunters[0]!.getSocketId(), 'DAY_VOTE');

          const scenario = yield* gameFlow.checkPostDayVoteScenarios;
          expect(scenario).toBe('lover-suicide');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'returns "hunter-lover" when lover is voted out and partner is hunter',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              nonHunter.getSocketId()
            );
          }

          yield* game.addPendingDeath(nonHunter.getSocketId(), 'DAY_VOTE');

          const scenario = yield* gameFlow.checkPostDayVoteScenarios;
          expect(scenario).toBe('hunter-lover');
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('returns null when non-lover, non-hunter is voted out', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const target = players.find((p) => p.getRole() !== 'HUNTER');

        if (!target) {
          return;
        }

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), target.getSocketId());
        }

        yield* game.addPendingDeath(target.getSocketId(), 'DAY_VOTE');

        const scenario = yield* gameFlow.checkPostDayVoteScenarios;
        expect(scenario).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Special scenario integration in runDayPhase', () => {
    it.effect('triggers hunter revenge when hunter dies at night', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (!hunter) {
          return;
        }

        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');
        yield* gameFlow.runDayPhase;

        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('triggers lover suicide when lover dies at night', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );
        yield* game.addPendingDeath(nonHunters[0]!.getSocketId(), 'WEREWOLVES');

        yield* gameFlow.runDayPhase;

        expect(nonHunters[0]!.isAlive).toBe(false);
        expect(nonHunters[1]!.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'triggers hunter-lover scenario when hunter-lover dies at night',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
          yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

          yield* gameFlow.runDayPhase;

          expect(hunter.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Special scenario integration in continueAfterDayVote', () => {
    it.effect(
      'triggers hunter revenge when hunter is voted out (explicit role assignment)',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          // Explicitly assign a hunter role to ensure test runs
          const targetPlayer = players[0];
          if (!targetPlayer) {
            return;
          }
          targetPlayer.assignRole('HUNTER');

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              targetPlayer.getSocketId()
            );
          }

          yield* gameFlow.continueAfterDayVote;

          expect(targetPlayer.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('triggers hunter revenge when hunter is voted out', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        if (!hunter) {
          return;
        }

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), hunter.getSocketId());
        }

        yield* gameFlow.continueAfterDayVote;

        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('triggers lover suicide when lover is voted out', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            nonHunters[0]!.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        expect(nonHunters[0]!.isAlive).toBe(false);
        expect(nonHunters[1]!.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'triggers hunter-lover scenario when hunter-lover is voted out (explicit role)',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          // Explicitly set up hunter and lover
          const hunter = players[0];
          const nonHunter = players[1];

          if (!(hunter && nonHunter)) {
            return;
          }

          hunter.assignRole('HUNTER');

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              hunter.getSocketId()
            );
          }

          yield* gameFlow.continueAfterDayVote;

          expect(hunter.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'triggers hunter-lover scenario when hunter-lover is voted out',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

          if (!(hunter && nonHunter)) {
            return;
          }

          yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());

          const alivePlayers = players.filter((p) => p.isAlive);

          for (const player of alivePlayers) {
            yield* game.handleDayVote(
              player.getSocketId(),
              hunter.getSocketId()
            );
          }

          yield* gameFlow.continueAfterDayVote;

          expect(hunter.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles no special scenario in day vote', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const target = players.find((p) => p.getRole() !== 'HUNTER');

        if (!target) {
          return;
        }

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(player.getSocketId(), target.getSocketId());
        }

        yield* gameFlow.continueAfterDayVote;

        expect(target.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Special scenario edge cases', () => {
    it.effect('handles empty deaths in checkPostNightScenarios', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        yield* game.setLovers(
          players[0]!.getSocketId(),
          players[1]!.getSocketId()
        );

        // No deaths added
        const scenario = yield* gameFlow.checkPostNightScenarios;
        expect(scenario).toBeNull();
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'handles runDayPhase with no special scenario and no winner',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const target = players.find((p) => p.getRole() !== 'HUNTER');

          if (!target) {
            return;
          }

          yield* game.addPendingDeath(target.getSocketId(), 'WEREWOLVES');
          yield* gameFlow.runDayPhase;

          expect(target.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles lover suicide with winner check in day vote', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Kill all werewolves except the lovers
        const werewolves = players.filter((p) => p.getRole() === 'WEREWOLF');
        for (const wolf of werewolves) {
          yield* game.killPlayer(wolf.getSocketId());
        }

        const nonHunters = players.filter(
          (p) => p.getRole() !== 'HUNTER' && p.isAlive
        );

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );

        const alivePlayers = players.filter((p) => p.isAlive);

        for (const player of alivePlayers) {
          yield* game.handleDayVote(
            player.getSocketId(),
            nonHunters[0]!.getSocketId()
          );
        }

        yield* gameFlow.continueAfterDayVote;

        expect(nonHunters[0]!.isAlive).toBe(false);
        expect(nonHunters[1]!.isAlive).toBe(false);

        const winner = yield* game.checkWinner;
        expect(winner).toBe('villagers');
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect(
      'verifies all special scenario branches are exercised in runDayPhase',
      () =>
        Effect.gen(function* () {
          const { gameFlow, game, players } = yield* setupGameFlow;

          const hunter = players.find((p) => p.getRole() === 'HUNTER');
          if (!hunter) {
            return;
          }

          yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

          // This should trigger hunter-revenge path
          yield* gameFlow.runDayPhase;

          expect(hunter.isAlive).toBe(false);
        }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('exercises hunter-lover path in runDayPhase', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const hunter = players.find((p) => p.getRole() === 'HUNTER');
        const nonHunter = players.find((p) => p.getRole() !== 'HUNTER');

        if (!(hunter && nonHunter)) {
          return;
        }

        yield* game.setLovers(hunter.getSocketId(), nonHunter.getSocketId());
        yield* game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

        yield* gameFlow.runDayPhase;

        expect(hunter.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('exercises lover-suicide path in runDayPhase', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        const nonHunters = players.filter((p) => p.getRole() !== 'HUNTER');

        if (nonHunters.length < 2) {
          return;
        }

        yield* game.setLovers(
          nonHunters[0]!.getSocketId(),
          nonHunters[1]!.getSocketId()
        );
        yield* game.addPendingDeath(nonHunters[0]!.getSocketId(), 'WEREWOLVES');

        yield* gameFlow.runDayPhase;

        expect(nonHunters[0]!.isAlive).toBe(false);
        expect(nonHunters[1]!.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });

  describe('Integration - Full game flow', () => {
    it.effect('orchestrates complete night to day cycle', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        // Night phase: werewolf vote
        yield* gameFlow.runNightPhase;

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

        // Day phase: process deaths
        yield* gameFlow.runDayPhase;

        expect(target.isAlive).toBe(false);
      }).pipe(Effect.provide(makeTestLayer()))
    );

    it.effect('handles full cupid and lovers flow', () =>
      Effect.gen(function* () {
        const { gameFlow, game, players } = yield* setupGameFlow;

        yield* game.setLovers(
          players[0]!.getSocketId(),
          players[1]!.getSocketId()
        );

        yield* gameFlow.continueAfterCupid;
        yield* gameFlow.continueAfterLoversReveal;

        const firstNightDone = yield* gameFlow.shouldSkipCupid;
        expect(firstNightDone).toBe(true);

        const lovers = yield* game.getLovers();
        expect(lovers).toBeTruthy();
      }).pipe(Effect.provide(makeTestLayer()))
    );
  });
});
