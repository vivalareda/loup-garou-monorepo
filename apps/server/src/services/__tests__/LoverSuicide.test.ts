import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import { Player } from '../../core/player.js';
import { DeathManager } from '../DeathManager.js';

describe('DeathManager - Partner Suicide Logic', () => {
  it('should handle partner suicide when one lover dies', () => {
    const program = Effect.gen(function* () {
      const deathManager = yield* DeathManager;

      // Add a direct death (e.g. werewolf kill)
      yield* deathManager.addPendingDeath('player1', 'WEREWOLVES');

      // Mock getPartner to return 'player2' for 'player1'
      const getPartnerMock = (playerId: string) => {
        if (playerId === 'player1') {
          return Effect.succeed('player2');
        }
        return Effect.succeed(undefined);
      };

      const deaths = yield* deathManager.processDeaths(getPartnerMock);

      // Expect player1 to die from WEREWOLVES
      const p1Death = deaths.find((d) => d.playerId === 'player1');
      expect(p1Death).toBeDefined();
      expect(p1Death?.cause).toBe('WEREWOLVES');

      // Expect player2 to die from PARTNER_SUICIDE
      const p2Death = deaths.find((d) => d.playerId === 'player2');
      expect(p2Death).toBeDefined();
      expect(p2Death?.cause).toBe('PARTNER_SUICIDE');
      expect(p2Death?.metadata?.loverId).toBe('player1');
    });

    const runnable = program.pipe(Effect.provide(DeathManager.Default));

    Effect.runSync(runnable);
  });

  it('should not cause suicide loop if both die simultaneously', () => {
    const program = Effect.gen(function* () {
      const deathManager = yield* DeathManager;

      // Both lovers die directly (e.g. one by WW, one by Witch)
      yield* deathManager.addPendingDeath('player1', 'WEREWOLVES');
      yield* deathManager.addPendingDeath('player2', 'WITCH_POISON');

      const getPartnerMock = (playerId: string) => {
        if (playerId === 'player1') return Effect.succeed('player2');
        if (playerId === 'player2') return Effect.succeed('player1');
        return Effect.succeed(undefined);
      };

      const deaths = yield* deathManager.processDeaths(getPartnerMock);

      // Expect player1 to keep original cause
      const p1Death = deaths.find((d) => d.playerId === 'player1');
      expect(p1Death?.cause).toBe('WEREWOLVES');

      // Expect player2 to keep original cause (not replaced by suicide)
      const p2Death = deaths.find((d) => d.playerId === 'player2');
      expect(p2Death?.cause).toBe('WITCH_POISON');
    });

    const runnable = program.pipe(Effect.provide(DeathManager.Default));

    Effect.runSync(runnable);
  });
});
