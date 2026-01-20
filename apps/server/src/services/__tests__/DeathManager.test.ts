import type { PendingDeath } from '@repo/types';
import { Effect } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { Player } from '../../core/player.js';
import { DeathManager } from '../DeathManager.js';

describe('DeathManager', () => {
  let deathManager: Effect.Effect.Success<typeof DeathManager>;

  beforeEach(() => {
    const program = Effect.gen(function* () {
      return yield* DeathManager;
    });

    deathManager = Effect.runSync(
      program.pipe(Effect.provide(DeathManager.Default))
    );
  });

  it('should be able to add pending death', () => {
    const program = Effect.gen(function* () {
      yield* deathManager.addPendingDeath('socket1', 'WEREWOLVES');
      const pendingDeaths = yield* deathManager.getPendingDeaths();
      expect(pendingDeaths).toHaveLength(1);
      expect(pendingDeaths[0]?.playerId).toBe('socket1');
      expect(pendingDeaths[0]?.cause).toBe('WEREWOLVES');
    });

    Effect.runSync(program);
  });

  it('should be able to clear pending deaths', () => {
    const program = Effect.gen(function* () {
      yield* deathManager.addPendingDeath('socket1', 'WEREWOLVES');
      yield* deathManager.clearPendingDeaths();
      const pendingDeaths = yield* deathManager.getPendingDeaths();
      expect(pendingDeaths).toEqual([]);
    });

    Effect.runSync(program);
  });

  it('should be able to check if a player is pending death', () => {
    const program = Effect.gen(function* () {
      yield* deathManager.addPendingDeath('socket1', 'WEREWOLVES');
      const isPending = yield* deathManager.isPendingDeath('socket1');
      expect(isPending).toBe(true);
      const isPending2 = yield* deathManager.isPendingDeath('socket2');
      expect(isPending2).toBe(false);
    });

    Effect.runSync(program);
  });

  it('should be able to heal werewolves victim', () => {
    const program = Effect.gen(function* () {
      yield* deathManager.addPendingDeath('socket1', 'WEREWOLVES');
      yield* deathManager.addPendingDeath('socket2', 'WITCH_POISON');
      yield* deathManager.healWerewolvesVictim();
      const pendingDeaths = yield* deathManager.getPendingDeaths();
      expect(pendingDeaths).toHaveLength(1);
      expect(pendingDeaths[0]?.playerId).toBe('socket2');
      expect(pendingDeaths[0]?.cause).toBe('WITCH_POISON');
    });

    Effect.runSync(program);
  });

  it('should add specific death types correctly', () => {
    const program = Effect.gen(function* () {
      yield* deathManager.addPartnerSuicide('socket1', 'socket2');
      yield* deathManager.addHunterRevenge('socket3', 'socket4');
      yield* deathManager.addDayVoteElimination('socket5', 5);
      yield* deathManager.addWitchPoison('socket6');

      const pendingDeaths = yield* deathManager.getPendingDeaths();
      expect(pendingDeaths).toHaveLength(4);

      const suicide = pendingDeaths.find(
        (d: PendingDeath) => d.playerId === 'socket1'
      );
      expect(suicide?.cause).toBe('PARTNER_SUICIDE');
      expect(suicide?.metadata?.loverId).toBe('socket2');

      const revenge = pendingDeaths.find(
        (d: PendingDeath) => d.playerId === 'socket3'
      );
      expect(revenge?.cause).toBe('HUNTER_REVENGE');
      expect(revenge?.metadata?.hunterId).toBe('socket4');

      const vote = pendingDeaths.find(
        (d: PendingDeath) => d.playerId === 'socket5'
      );
      expect(vote?.cause).toBe('DAY_VOTE');
      expect(vote?.metadata?.voteCount).toBe(5);

      const poison = pendingDeaths.find(
        (d: PendingDeath) => d.playerId === 'socket6'
      );
      expect(poison?.cause).toBe('WITCH_POISON');
    });

    Effect.runSync(program);
  });

  it('should manage teams correctly', () => {
    const program = Effect.gen(function* () {
      const werewolf = new Player('Werewolf', 'socket1', 'WEREWOLF');
      const villager = new Player('Villager', 'socket2', 'VILLAGER');

      yield* deathManager.addTeamWerewolf(werewolf);
      yield* deathManager.addTeamVillager(villager);

      const teamWerewolves = yield* deathManager.getTeamWerewolves();
      const teamVillagers = yield* deathManager.getTeamVillagers();

      expect(teamWerewolves).toHaveLength(1);
      expect(teamWerewolves[0]).toBe(werewolf);

      expect(teamVillagers).toHaveLength(1);
      expect(teamVillagers[0]).toBe(villager);
    });

    Effect.runSync(program);
  });

  describe('processDeaths', () => {
    it('should process direct deaths', () => {
      const program = Effect.gen(function* () {
        yield* deathManager.addPendingDeath('p1', 'WEREWOLVES');
        yield* deathManager.addPendingDeath('p2', 'WITCH_POISON');

        const deaths = yield* deathManager.processDeaths(() =>
          Effect.succeed(undefined)
        );

        expect(deaths).toHaveLength(2);
        expect(deaths.find((d) => d.playerId === 'p1')?.cause).toBe(
          'WEREWOLVES'
        );
        expect(deaths.find((d) => d.playerId === 'p2')?.cause).toBe(
          'WITCH_POISON'
        );
      });

      Effect.runSync(program);
    });

    it('should handle cascades (lovers suicide)', () => {
      const program = Effect.gen(function* () {
        // p1 dies, p2 is lover of p1
        yield* deathManager.addPendingDeath('p1', 'WEREWOLVES');

        const deaths = yield* deathManager.processDeaths((id) =>
          id === 'p1' ? Effect.succeed('p2') : Effect.succeed(undefined)
        );

        expect(deaths).toHaveLength(2);

        const p1Death = deaths.find((d) => d.playerId === 'p1');
        expect(p1Death?.cause).toBe('WEREWOLVES');

        const p2Death = deaths.find((d) => d.playerId === 'p2');
        expect(p2Death?.cause).toBe('PARTNER_SUICIDE');
        expect(p2Death?.metadata?.loverId).toBe('p1');
      });

      Effect.runSync(program);
    });

    it('should not add duplicate deaths if lover is already dead', () => {
      const program = Effect.gen(function* () {
        // both die directly
        yield* deathManager.addPendingDeath('p1', 'WEREWOLVES');
        yield* deathManager.addPendingDeath('p2', 'WITCH_POISON');

        // p2 is lover of p1, but p2 is already dying
        const deaths = yield* deathManager.processDeaths((id) =>
          id === 'p1' ? Effect.succeed('p2') : Effect.succeed(undefined)
        );

        expect(deaths).toHaveLength(2);
        // p2 should keep original cause
        const p2Death = deaths.find((d) => d.playerId === 'p2');
        expect(p2Death?.cause).toBe('WITCH_POISON');
      });

      Effect.runSync(program);
    });
  });
});
