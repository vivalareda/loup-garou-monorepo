import { Effect } from 'effect';
import { beforeEach, describe, expect, it } from 'vitest';
import { Player } from '../../core/player.js';
import { DeathManager } from '../DeathManager.js';

describe('DeathManager - checkWinner', () => {
  let deathManager: Effect.Effect.Success<typeof DeathManager>;

  beforeEach(() => {
    const program = Effect.gen(function* () {
      return yield* DeathManager;
    });

    deathManager = Effect.runSync(
      program.pipe(Effect.provide(DeathManager.Default))
    );
  });

  it('should return undefined when both teams are alive and balanced', () => {
    const program = Effect.gen(function* () {
      const werewolf = new Player('Werewolf', 'socket1', 'WEREWOLF');
      const villager1 = new Player('Villager1', 'socket2', 'VILLAGER');
      const villager2 = new Player('Villager2', 'socket3', 'VILLAGER');

      yield* deathManager.addTeamWerewolf(werewolf);
      yield* deathManager.addTeamVillager(villager1);
      yield* deathManager.addTeamVillager(villager2);

      const winner = yield* deathManager.checkWinner();
      expect(winner).toBeNull();
    });

    Effect.runSync(program);
  });

  it('should return VILLAGERS when no werewolves are alive', () => {
    const program = Effect.gen(function* () {
      const villager = new Player('Villager', 'socket1', 'VILLAGER');

      yield* deathManager.addTeamVillager(villager);

      // No werewolves added means all are dead/non-existent

      const winner = yield* deathManager.checkWinner();
      expect(winner).toBe('VILLAGERS');
    });

    Effect.runSync(program);
  });

  it('should return WEREWOLVES when werewolves outnumber or equal villagers', () => {
    const program = Effect.gen(function* () {
      const werewolf1 = new Player('Werewolf1', 'socket1', 'WEREWOLF');
      const werewolf2 = new Player('Werewolf2', 'socket2', 'WEREWOLF');
      const villager = new Player('Villager', 'socket3', 'VILLAGER');

      yield* deathManager.addTeamWerewolf(werewolf1);
      yield* deathManager.addTeamWerewolf(werewolf2);
      yield* deathManager.addTeamVillager(villager);

      const winner = yield* deathManager.checkWinner();
      expect(winner).toBe('WEREWOLVES');
    });

    Effect.runSync(program);
  });

  it('should return WEREWOLVES when werewolves equal villagers count', () => {
    const program = Effect.gen(function* () {
      const werewolf = new Player('Werewolf', 'socket1', 'WEREWOLF');
      const villager = new Player('Villager', 'socket2', 'VILLAGER');

      yield* deathManager.addTeamWerewolf(werewolf);
      yield* deathManager.addTeamVillager(villager);

      const winner = yield* deathManager.checkWinner();
      expect(winner).toBe('WEREWOLVES');
    });

    Effect.runSync(program);
  });
});
