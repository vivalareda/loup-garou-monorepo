// import type {
//   ClientToServerEvents,
//   Role,
//   ServerToClientEvents,
// } from '@repo/types';
// import { Effect } from 'effect';
// import type { Socket as ClientSocket } from 'socket.io-client';
// import { io as ioClient } from 'socket.io-client';
// import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// import { SocketServer } from '../socket-server.js';
//
// let serverCleanup: (() => void) | null = null;
// const TEST_PORT = 3002;
// const SERVER_URL = `http://localhost:${TEST_PORT}`;
//
// beforeAll(async () => {
//   process.env.PORT = TEST_PORT.toString();
//
//   const program = Effect.gen(function* () {
//     yield* SocketServer;
//     return yield* Effect.never;
//   }).pipe(Effect.provide(SocketServer.Default));
//
//   const fiber = await Effect.runFork(program);
//
//   await new Promise((resolve) => setTimeout(resolve, 1000));
//
//   serverCleanup = () => {
//     fiber.unsafeInterruptAsFork(fiber.id());
//   };
// });
//
// afterAll(() => {
//   if (serverCleanup) {
//     serverCleanup();
//   }
// });
//
// function createClient(): Promise<
//   ClientSocket<ServerToClientEvents, ClientToServerEvents>
// > {
//   return new Promise((resolve, reject) => {
//     const client = ioClient(SERVER_URL, {
//       transports: ['websocket'],
//     });
//
//     client.on('connect', () => resolve(client));
//     client.on('connect_error', reject);
//
//     setTimeout(() => reject(new Error('Connection timeout')), 3000);
//   });
// }
//
// describe('Game Start Integration', () => {
//   it('should start game with 6 players and assign roles', async () => {
//     const playerNames = ['Alice', 'Bob', 'Charlie', 'David', 'Eve', 'Frank'];
//     const clients: ClientSocket<ServerToClientEvents, ClientToServerEvents>[] =
//       [];
//     const rolePromises: Promise<Role>[] = [];
//
//     for (const name of playerNames) {
//       const client = await createClient();
//       clients.push(client);
//
//       const rolePromise = new Promise<Role>((resolve) => {
//         client.on('player:role-assigned', (role: Role) => {
//           resolve(role);
//         });
//       });
//       rolePromises.push(rolePromise);
//
//       client.emit('player:join', name);
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     }
//
//     clients[0].emit('admin:start-game');
//
//     const assignedRoles = await Promise.race([
//       Promise.all(rolePromises),
//       new Promise<Role[]>((_, reject) =>
//         setTimeout(() => reject(new Error('Timeout waiting for roles')), 3000)
//       ),
//     ]);
//
//     expect(assignedRoles.length).toBe(6);
//
//     const roleCounts = assignedRoles.reduce(
//       (acc, role) => {
//         acc[role] = (acc[role] || 0) + 1;
//         return acc;
//       },
//       {} as Record<Role, number>
//     );
//
//     expect(roleCounts.WEREWOLF).toBe(2);
//     expect(roleCounts.CUPID).toBe(1);
//     expect(roleCounts.WITCH).toBe(1);
//     expect(roleCounts.VILLAGER).toBe(2);
//
//     for (const client of clients) {
//       client.disconnect();
//     }
//   });
//
//   it('should reject game start with less than 4 players', async () => {
//     const playerNames = ['Alice2', 'Bob2', 'Charlie2'];
//     const clients: ClientSocket<ServerToClientEvents, ClientToServerEvents>[] =
//       [];
//
//     for (const name of playerNames) {
//       const client = await createClient();
//       clients.push(client);
//
//       client.emit('player:join', name);
//       await new Promise((resolve) => setTimeout(resolve, 100));
//     }
//
//     let roleEmitted = false;
//     clients[0].on('player:role-assigned', () => {
//       roleEmitted = true;
//     });
//
//     clients[0].emit('admin:start-game');
//
//     await new Promise((resolve) => setTimeout(resolve, 500));
//
//     expect(roleEmitted).toBe(false);
//
//     for (const client of clients) {
//       client.disconnect();
//     }
//   });
// });
