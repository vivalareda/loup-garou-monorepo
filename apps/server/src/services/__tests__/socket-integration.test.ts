// import type { ClientToServerEvents, ServerToClientEvents } from '@repo/types';
// import { Effect } from 'effect';
// import type { Socket as ClientSocket } from 'socket.io-client';
// import { io as ioClient } from 'socket.io-client';
// import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// import { SocketServer } from '../socket-server.js';
//
// let serverCleanup: (() => void) | null = null;
// const TEST_PORT = 3001;
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
// describe('Socket.IO Integration', () => {
//   it('should allow client to connect and receive player data on join', async () => {
//     const client = await createClient();
//
//     const playerData = await new Promise((resolve) => {
//       client.once('lobby:player-data', resolve);
//       client.emit('player:join', `TestPlayer-${Date.now()}`);
//     });
//
//     expect(playerData).toHaveProperty('type', 'waiting');
//     expect(playerData).toHaveProperty('name');
//     expect(playerData).toHaveProperty('socketId', client.id);
//
//     client.disconnect();
//   });
//
//   it('should broadcast join events to other connected clients', async () => {
//     const client1 = await createClient();
//     const client2 = await createClient();
//
//     const uniqueName = `Player-${Date.now()}`;
//
//     const updateReceived = new Promise((resolve) => {
//       client1.once('lobby:update-players-list', resolve);
//     });
//
//     client2.emit('player:join', uniqueName);
//     const update = await updateReceived;
//
//     expect(update).toEqual({
//       name: uniqueName,
//       socketId: client2.id,
//     });
//
//     client1.disconnect();
//     client2.disconnect();
//   });
//
//   it('should return players list when requested', async () => {
//     const client = await createClient();
//
//     const playersList = await new Promise((resolve) => {
//       client.once('lobby:players-list', resolve);
//       client.emit('lobby:get-players-list');
//     });
//
//     expect(Array.isArray(playersList)).toBe(true);
//
//     client.disconnect();
//   });
//
//   it('should notify other clients when a player disconnects', async () => {
//     const client1 = await createClient();
//     const client2 = await createClient();
//
//     const uniqueName = `DisconnectTest-${Date.now()}`;
//     client1.emit('player:join', uniqueName);
//     await new Promise((resolve) => setTimeout(resolve, 200));
//
//     const playerLeft = new Promise((resolve) => {
//       client2.once('lobby:player-left', resolve);
//     });
//
//     client1.disconnect();
//     const leftPlayerName = await playerLeft;
//
//     expect(leftPlayerName).toBe(uniqueName);
//
//     client2.disconnect();
//   });
// });
