// import type { PlayerListItem, WaitingRoomPlayer } from '@repo/types';
// import { Effect, HashMap, Ref, Schema } from 'effect';
//
// export class LobbyFull extends Schema.TaggedError<LobbyFull>()('LobbyFull', {
//   maxPlayers: Schema.Number,
// }) {}
//
// export class PlayerNotFound extends Schema.TaggedError<PlayerNotFound>()(
//   'PlayerNotFound',
//   {
//     socketId: Schema.String,
//   }
// ) {}
//
// export class LobbyConfig extends Effect.Service<LobbyConfig>()('LobbyConfig', {
//   effect: Effect.succeed({ maxPlayers: 6 }),
// }) {}
//
// export class Lobby extends Effect.Service<Lobby>()('@app/Lobby', {
//   effect: Effect.gen(function* () {
//     const config = yield* LobbyConfig;
//     const playersRef = yield* Ref.make(
//       HashMap.empty<string, WaitingRoomPlayer>()
//     );
//
//     return {
//       addPlayer: Effect.fn('Lobby.addPlayer')(function* (
//         name: string,
//         socketId: string
//       ) {
//         const players = yield* Ref.get(playersRef);
//         const count = HashMap.size(players);
//
//         if (count >= config.maxPlayers) {
//           return yield* new LobbyFull({ maxPlayers: config.maxPlayers });
//         }
//
//         const player: WaitingRoomPlayer = {
//           type: 'waiting',
//           name,
//           socketId,
//         };
//
//         yield* Ref.update(playersRef, HashMap.set(socketId, player));
//         return player;
//       }),
//
//       removePlayer: Effect.fn('Lobby.removePlayer')(function* (
//         socketId: string
//       ) {
//         const players = yield* Ref.get(playersRef);
//         const player = HashMap.get(players, socketId);
//
//         if (player._tag === 'None') {
//           return null;
//         }
//
//         yield* Ref.update(playersRef, HashMap.remove(socketId));
//         return player.value;
//       }),
//
//       getPlayers: Effect.fn('Lobby.getPlayers')(function* () {
//         const players = yield* Ref.get(playersRef);
//         return Array.from(HashMap.values(players)).map(
//           (p): PlayerListItem => ({
//             name: p.name,
//             socketId: p.socketId,
//           })
//         );
//       }),
//
//       getPlayerCount: Effect.fn('Lobby.getPlayerCount')(function* () {
//         const players = yield* Ref.get(playersRef);
//         return HashMap.size(players);
//       }),
//
//       clear: Effect.fn('Lobby.clear')(function* () {
//         yield* Ref.set(playersRef, HashMap.empty());
//       }),
//     };
//   }).pipe(Effect.annotateLogs('service', 'Lobby')),
//   dependencies: [LobbyConfig.Default],
// }) {}
