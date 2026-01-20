// import { describe, expect, it } from '@effect/vitest';
// import { Effect } from 'effect';
// import { NotEnoughPlayers, RoleAssignment } from '../role-assignment.js';
//
// describe('RoleAssignment Service', () => {
//   describe('calculateRoles', () => {
//     it.effect('should fail with NotEnoughPlayers if less than 4 players', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const result = yield* service.calculateRoles(3).pipe(Effect.flip);
//
//         expect(result).toBeInstanceOf(NotEnoughPlayers);
//         expect(result.playerCount).toBe(3);
//         expect(result.minPlayers).toBe(4);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should assign roles correctly for 4 players', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const distribution = yield* service.calculateRoles(4);
//
//         expect(distribution.WEREWOLF).toBe(1);
//         expect(distribution.CUPID).toBe(1);
//         expect(distribution.WITCH).toBe(0);
//         expect(distribution.HUNTER).toBe(0);
//         expect(distribution.VILLAGER).toBe(2);
//         expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(4);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should assign roles correctly for 6 players', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const distribution = yield* service.calculateRoles(6);
//
//         expect(distribution.WEREWOLF).toBe(2);
//         expect(distribution.CUPID).toBe(1);
//         expect(distribution.WITCH).toBe(1);
//         expect(distribution.HUNTER).toBe(0);
//         expect(distribution.VILLAGER).toBe(2);
//         expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(6);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should assign roles correctly for 8 players', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const distribution = yield* service.calculateRoles(8);
//
//         expect(distribution.WEREWOLF).toBe(2);
//         expect(distribution.CUPID).toBe(2);
//         expect(distribution.WITCH).toBe(1);
//         expect(distribution.HUNTER).toBe(1);
//         expect(distribution.VILLAGER).toBe(2);
//         expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(8);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should scale werewolves correctly for 9 players', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const distribution = yield* service.calculateRoles(9);
//
//         expect(distribution.WEREWOLF).toBe(3);
//         expect(Object.values(distribution).reduce((a, b) => a + b, 0)).toBe(9);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//   });
//
//   describe('generateRoleList', () => {
//     it.effect('should generate a list with correct length', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const roles = yield* service.generateRoleList(6);
//
//         expect(roles.length).toBe(6);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should generate roles matching distribution', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const roles = yield* service.generateRoleList(6);
//
//         const counts = roles.reduce(
//           (acc, role) => {
//             acc[role] = (acc[role] || 0) + 1;
//             return acc;
//           },
//           {} as Record<string, number>
//         );
//
//         expect(counts.WEREWOLF).toBe(2);
//         expect(counts.CUPID).toBe(1);
//         expect(counts.WITCH).toBe(1);
//         expect(counts.VILLAGER).toBe(2);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should shuffle roles (probabilistic test)', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//
//         const results: string[] = [];
//         for (let i = 0; i < 10; i++) {
//           const roles = yield* service.generateRoleList(6);
//           results.push(roles.join(','));
//         }
//
//         const uniqueArrangements = new Set(results).size;
//         expect(uniqueArrangements).toBeGreaterThan(1);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//   });
//
//   describe('shuffle', () => {
//     it.effect('should maintain array length', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const input = [1, 2, 3, 4, 5];
//         const shuffled = yield* service.shuffle(input);
//
//         expect(shuffled.length).toBe(input.length);
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//
//     it.effect('should contain all original elements', () =>
//       Effect.gen(function* () {
//         const service = yield* RoleAssignment;
//         const input = [1, 2, 3, 4, 5];
//         const shuffled = yield* service.shuffle(input);
//
//         expect(shuffled.sort()).toEqual(input.sort());
//       }).pipe(Effect.provide(RoleAssignment.Default))
//     );
//   });
// });
