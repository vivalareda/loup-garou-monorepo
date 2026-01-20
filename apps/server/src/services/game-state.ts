// import type { GamePlayer, PlayerListItem, Role } from '@repo/types';
// import { toGamePlayer } from '@repo/types';
// import { Effect, HashMap, Ref, Schema } from 'effect';
// import { Lobby } from './lobby.js';
// import { RoleAssignment } from './role-assignment.js';
//
// export class GameNotStarted extends Schema.TaggedError<GameNotStarted>()(
//   'GameNotStarted',
//   {}
// ) {}
//
// export class GameAlreadyStarted extends Schema.TaggedError<GameAlreadyStarted>()(
//   'GameAlreadyStarted',
//   {}
// ) {}
//
// export class PlayerNotInGame extends Schema.TaggedError<PlayerNotInGame>()(
//   'PlayerNotInGame',
//   {
//     socketId: Schema.String,
//   }
// ) {}
//
// export type GamePhase = 'waiting' | 'night' | 'day' | 'ended';
//
// export class GameState extends Effect.Service<GameState>()('@app/GameState', {
//   effect: Effect.gen(function* () {
//     const lobby = yield* Lobby;
//     const roleAssignment = yield* RoleAssignment;
//
//     const playersRef = yield* Ref.make(HashMap.empty<string, GamePlayer>());
//     const phaseRef = yield* Ref.make<GamePhase>('waiting');
//
//     return {
//       startGame: Effect.fn('GameState.startGame')(function* () {
//         const currentPhase = yield* Ref.get(phaseRef);
//
//         if (currentPhase !== 'waiting') {
//           return yield* new GameAlreadyStarted();
//         }
//
//         const waitingPlayers = yield* lobby.getPlayers();
//
//         if (waitingPlayers.length < 4) {
//           return yield* Effect.fail({
//             _tag: 'NotEnoughPlayers' as const,
//             playerCount: waitingPlayers.length,
//             minPlayers: 4,
//           });
//         }
//
//         const roles = yield* roleAssignment.generateRoleList(
//           waitingPlayers.length
//         );
//
//         const gamePlayers = HashMap.fromIterable(
//           waitingPlayers.map((wp, index) => {
//             const role = roles[index];
//             if (!role) {
//               throw new Error('Not enough roles for players');
//             }
//             const waitingPlayer = { ...wp, type: 'waiting' as const };
//             return [wp.socketId, toGamePlayer(waitingPlayer, role)] as const;
//           })
//         );
//
//         yield* Ref.set(playersRef, gamePlayers);
//         yield* Ref.set(phaseRef, 'night');
//         yield* lobby.clear();
//
//         return Array.from(HashMap.values(gamePlayers));
//       }),
//
//       getPlayers: Effect.fn('GameState.getPlayers')(function* () {
//         const players = yield* Ref.get(playersRef);
//         return Array.from(HashMap.values(players)).map(
//           (p): PlayerListItem => ({
//             name: p.name,
//             socketId: p.socketId,
//           })
//         );
//       }),
//
//       getPlayer: Effect.fn('GameState.getPlayer')(function* (socketId: string) {
//         const players = yield* Ref.get(playersRef);
//         const player = HashMap.get(players, socketId);
//
//         if (player._tag === 'None') {
//           return yield* new PlayerNotInGame({ socketId });
//         }
//
//         return player.value;
//       }),
//
//       getPhase: Effect.fn('GameState.getPhase')(function* () {
//         return yield* Ref.get(phaseRef);
//       }),
//
//       setPhase: Effect.fn('GameState.setPhase')(function* (phase: GamePhase) {
//         yield* Ref.set(phaseRef, phase);
//       }),
//
//       killPlayer: Effect.fn('GameState.killPlayer')(function* (
//         socketId: string
//       ) {
//         const players = yield* Ref.get(playersRef);
//         const player = HashMap.get(players, socketId);
//
//         if (player._tag === 'None') {
//           return yield* new PlayerNotInGame({ socketId });
//         }
//
//         const updatedPlayer: GamePlayer = {
//           ...player.value,
//           isAlive: false,
//         };
//
//         yield* Ref.update(playersRef, HashMap.set(socketId, updatedPlayer));
//         return updatedPlayer;
//       }),
//
//       getAlivePlayers: Effect.fn('GameState.getAlivePlayers')(function* () {
//         const players = yield* Ref.get(playersRef);
//         return Array.from(HashMap.values(players)).filter((p) => p.isAlive);
//       }),
//
//       getPlayersByRole: Effect.fn('GameState.getPlayersByRole')(function* (
//         role: Role
//       ) {
//         const players = yield* Ref.get(playersRef);
//         return Array.from(HashMap.values(players)).filter(
//           (p) => p.role === role
//         );
//       }),
//     };
//   }).pipe(Effect.annotateLogs('service', 'GameState')),
//   dependencies: [Lobby.Default, RoleAssignment.Default],
// }) {}
