// import type { Role } from '@repo/types';
// import { Effect, Schema } from 'effect';
//
// export class NotEnoughPlayers extends Schema.TaggedError<NotEnoughPlayers>()(
//   'NotEnoughPlayers',
//   {
//     playerCount: Schema.Number,
//     minPlayers: Schema.Number,
//   }
// ) {}
//
// export type RoleDistribution = Record<Role, number>;
//
// export class RoleAssignment extends Effect.Service<RoleAssignment>()(
//   '@app/RoleAssignment',
//   {
//     effect: Effect.gen(function* () {
//       /**
//        * Calculate role distribution based on player count
//        * Rules:
//        * - At least 1 werewolf per 3 players (rounded down, min 1)
//        * - Always 1 Cupid (2 if 8+ players)
//        * - 1 Witch if 6+ players
//        * - 1 Hunter if 8+ players
//        * - Remaining slots filled with villagers
//        */
//       const calculateRoles = Effect.fn('RoleAssignment.calculateRoles')(
//         function* (playerCount: number) {
//           const minPlayers = 4;
//
//           if (playerCount < minPlayers) {
//             return yield* new NotEnoughPlayers({ playerCount, minPlayers });
//           }
//
//           const werewolfCount = Math.max(1, Math.floor(playerCount / 3));
//           const distribution: RoleDistribution = {
//             VILLAGER: 0,
//             WEREWOLF: werewolfCount,
//             SEER: 0,
//             HUNTER: 0,
//             CUPID: 1,
//             WITCH: 0,
//           };
//
//           if (playerCount >= 6) {
//             distribution.WITCH = 1;
//           }
//
//           if (playerCount >= 8) {
//             distribution.HUNTER = 1;
//             distribution.CUPID = 2;
//           }
//
//           const assignedRoles = Object.values(distribution).reduce(
//             (sum, count) => sum + count,
//             0
//           );
//           distribution.VILLAGER = playerCount - assignedRoles;
//
//           return distribution;
//         }
//       );
//
//       /**
//        * Shuffle an array using Fisher-Yates algorithm
//        */
//       const shuffle = <T>(array: readonly T[]) =>
//         Effect.sync(() => {
//           const shuffled = [...array];
//           for (let i = shuffled.length - 1; i > 0; i--) {
//             const j = Math.floor(Math.random() * (i + 1));
//             [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
//           }
//           return shuffled;
//         });
//
//       const generateRoleList = Effect.fn('RoleAssignment.generateRoleList')(
//         function* (playerCount: number) {
//           const distribution = yield* calculateRoles(playerCount);
//           const roles: Role[] = [];
//
//           for (const [role, count] of Object.entries(distribution)) {
//             for (let i = 0; i < count; i++) {
//               roles.push(role as Role);
//             }
//           }
//
//           return yield* shuffle(roles);
//         }
//       );
//
//       return { calculateRoles, shuffle, generateRoleList };
//     }),
//   }
// ) {}
