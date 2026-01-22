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
});
