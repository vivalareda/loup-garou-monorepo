// import { createServer } from 'node:http';
// import type {
//   ClientToServerEvents,
//   PlayerListItem,
//   ServerToClientEvents,
// } from '@repo/types';
// import { Effect } from 'effect';
// import type { Socket } from 'socket.io';
// import { Server as SocketIOServer } from 'socket.io';
// import { GameState } from './game-state.js';
// import { Lobby } from './lobby.js';
//
// export class SocketServer extends Effect.Service<SocketServer>()(
//   '@app/SocketServer',
//   {
//     scoped: Effect.gen(function* () {
//       const lobby = yield* Lobby;
//       const gameState = yield* GameState;
//       const httpServer = createServer();
//       const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
//         httpServer,
//         {
//           cors: { origin: '*' },
//           pingTimeout: 60_000,
//           pingInterval: 25_000,
//         }
//       );
//
//       io.on('connection', (socket) => {
//         console.log('Player connected:', socket.id);
//         setupSocketHandlers(socket, lobby, gameState, io);
//       });
//
//       yield* Effect.async<void>((resume) => {
//         const port = Number.parseInt(process.env.PORT || '3000', 10);
//         httpServer.listen(port, '0.0.0.0', () => {
//           console.log(`Werewolf Game Server running on port ${port}`);
//           resume(Effect.void);
//         });
//       });
//
//       yield* Effect.addFinalizer(() =>
//         Effect.sync(() => {
//           console.log('Shutting down server...');
//           io.close();
//           httpServer.close();
//         })
//       );
//
//       return { io };
//     }),
//     dependencies: [Lobby.Default, GameState.Default],
//   }
// ) {}
//
// function setupSocketHandlers(
//   socket: Socket<ClientToServerEvents, ServerToClientEvents>,
//   lobby: Lobby,
//   gameState: GameState,
//   io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>
// ) {
//   socket.on('player:join', (name: string) => {
//     Effect.gen(function* () {
//       const player = yield* lobby.addPlayer(name, socket.id);
//       const playerCount = yield* lobby.getPlayerCount();
//
//       socket.emit('lobby:player-data', player);
//
//       socket.broadcast.emit('lobby:update-players-list', {
//         name: player.name,
//         socketId: player.socketId,
//       });
//
//       console.log(
//         `Player joined: ${name} (ID: ${socket.id}), player count: ${playerCount}`
//       );
//     }).pipe(
//       Effect.catchTag('LobbyFull', (error) =>
//         Effect.sync(() => {
//           console.warn(
//             `Lobby full (${error.maxPlayers}), rejecting ${socket.id}`
//           );
//           socket.disconnect(true);
//         })
//       ),
//       Effect.runPromise
//     );
//   });
//
//   socket.on('lobby:get-players-list', () => {
//     Effect.gen(function* () {
//       const players = yield* lobby.getPlayers();
//       socket.emit('lobby:players-list', players as PlayerListItem[]);
//     }).pipe(Effect.runPromise);
//   });
//
//   socket.on('disconnect', () => {
//     Effect.gen(function* () {
//       const player = yield* lobby.removePlayer(socket.id);
//       if (player) {
//         io.emit('lobby:player-left', player.name);
//         console.log(`Player disconnected: ${player.name} (${socket.id})`);
//       }
//     }).pipe(Effect.runPromise);
//   });
//
//   socket.on('admin:start-game', () => {
//     Effect.gen(function* () {
//       const gamePlayers = yield* gameState.startGame();
//
//       for (const player of gamePlayers) {
//         io.to(player.socketId).emit('player:role-assigned', player.role);
//       }
//
//       console.log(`Game started with ${gamePlayers.length} players`);
//     }).pipe(
//       Effect.catchTag('GameAlreadyStarted', () =>
//         Effect.sync(() => {
//           console.warn('Game already started');
//         })
//       ),
//       Effect.catchTag('NotEnoughPlayers', (error) =>
//         Effect.sync(() => {
//           console.warn(
//             `Not enough players to start (${error.playerCount}/${error.minPlayers})`
//           );
//         })
//       ),
//       Effect.runPromise
//     );
//   });
// }
