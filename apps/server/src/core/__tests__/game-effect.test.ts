import { describe, expect, it } from '@effect/vitest';
import { Effect, Layer } from 'effect';
import { DeathManagerLive } from '@/core/death-manager-effect';
import { GameLive, GameService } from '@/core/game-effect';

describe('GameService', () => {
  const TestLayer = GameLive.pipe(Layer.provide(DeathManagerLive));

  it('should add and retrieve players', () =>
    Effect.gen(function* (_) {
      const service = yield* _(GameService);

      yield* _(service.addPlayer('Alice', 'p1'));
      yield* _(service.addPlayer('Bob', 'p2'));

      const players = yield* _(service.getPlayerList);
      expect(players).toHaveLength(2);
      expect(players.find((p) => p.getName() === 'Alice')).toBeDefined();

      const p1 = yield* _(service.getPlayerBySocketId('p1'));
      expect(p1?.getName()).toBe('Alice');
    }).pipe(Effect.provide(TestLayer)));

  it('should initialize roles based on player count', () =>
    Effect.gen(function* (_) {
      const service = yield* _(GameService);

      // Add 4 players
      for (let i = 0; i < 4; i++) {
        yield* _(service.addPlayer(`P${i}`, `p${i}`));
      }

      yield* _(service.initRolesList);
      yield* _(service.assignRoles);

      const players = yield* _(service.getPlayerList);
      const roles = players.map((p) => p.getRole());

      expect(roles).toContain('WEREWOLF');
      expect(roles).toContain('CUPID');
    }).pipe(Effect.provide(TestLayer)));

  it('should manage lovers', () =>
    Effect.gen(function* (_) {
      const service = yield* _(GameService);

      yield* _(service.addPlayer('Alice', 'p1'));
      yield* _(service.addPlayer('Bob', 'p2'));

      yield* _(service.setLovers(['p1', 'p2']));

      const lovers = yield* _(service.getLovers);
      expect(lovers).toHaveLength(2);

      const isLover = yield* _(service.hasPartner('p1'));
      expect(isLover).toBe(true);

      const p1 = yield* _(service.getPlayerBySocketId('p1'));
      if (p1) {
        const partner = yield* _(service.getPartner(p1));
        expect(partner?.getSocketId()).toBe('p2');
      }
    }).pipe(Effect.provide(TestLayer)));

  it('should fail when setting invalid lover', () =>
    Effect.gen(function* (_) {
      const service = yield* _(GameService);

      const result = yield* _(Effect.exit(service.setLovers(['invalid'])));
      expect(result._tag).toBe('Failure');
    }).pipe(Effect.provide(TestLayer)));

  it('should correctly identify werewolves', () =>
    Effect.gen(function* (_) {
      const service = yield* _(GameService);

      // We need enough players to get a werewolf
      for (let i = 0; i < 4; i++) {
        yield* _(service.addPlayer(`P${i}`, `p${i}`));
      }

      yield* _(service.assignRoles);

      const players = yield* _(service.getPlayerList);
      const werewolf = players.find((p) => p.getRole() === 'WEREWOLF');

      if (werewolf) {
        const isWW = yield* _(service.isWerewolf(werewolf.getSocketId()));
        expect(isWW).toBe(true);
      } else {
        // Fallback if random assignment didn't give a werewolf (unlikely with logic but possible if logic changes)
        // With 4 players logic ensures 1 werewolf
        throw new Error('No werewolf assigned');
      }
    }).pipe(Effect.provide(TestLayer)));
});
