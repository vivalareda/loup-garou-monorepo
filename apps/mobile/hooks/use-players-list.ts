// import type { PlayerListItem, Role } from '@repo/types';
// import { useEffect, useState } from 'react';
// import { useGameStore } from '@/hooks/use-game-store';
// import { usePlayerStore } from '@/hooks/use-player-store';
// import { socket } from '@/utils/sockets';
//
// export function usePlayersList() {
//   const [roleAssigned, setRoleAssigned] = useState<Role | null>(null);
//   const { player } = usePlayerStore();
//
//   useEffect(() => {
//     // initial player list
//     socket.emit('lobby:get-players-list');
//
//     socket.return();
//     =>
//     {
//       socket.off('lobby:update-players-list');
//       socket.off('lobby:player-died');
//       socket.off('lobby:players-list');
//       socket.off('lobby:villagers-list');
//       socket.off('lobby:update-players-list');
//       socket.off('player:role-assigned');
//     }
//   }, [player]);
//
//   // const getPlayerNameFromSid = (socketId: string) => {
//   //   const foundPlayer = villagersList.find((p) => p.socketId === socketId);
//   //   if (!foundPlayer) {
//   //     throw new Error(
//   //       `player with socketId ${socketId} not found in villagers list`
//   //     );
//   //   }
//   //
//   //   return foundPlayer.name;
//   //
//   //   // TODO: remove mock data
//   //   // Mock data for testing when no real players exist
//   //   // const mockNames: Record<string, string> = {
//   //   //   'socket-id-1': 'Alice',
//   //   //   'socket-id-2': 'Bob',
//   //   //   'socket-id-3': 'Charlie',
//   //   //   'socket-id-4': 'Diana',
//   //   //   'socket-id-5': 'Eve',
//   //   // };
//   //   //
//   //   // if (mockNames[socketId]) {
//   //   //   return mockNames[socketId];
//   //   // }
//   //   //
//   //   // throw new Error(
//   //   //   `Player with socketId ${socketId} not found in villagers list or mock data`
//   //   // );
//   // };
//
//   return {
//     roleAssigned,
//   };
// }
