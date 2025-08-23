import type { PlayerListItem, Role } from '@repo/types';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { socket } from '@/utils/sockets';

export function usePlayersList() {
  const [playersList, setPlayersList] = useState<PlayerListItem[]>([]);
  const [roleAssigned, setRoleAssigned] = useState<Role | null>(null);
  const [villagersList, setVillagersList] = useState<PlayerListItem[]>([]);
  const { player } = usePlayerStore();

  useEffect(() => {
    // initial player list
    socket.emit('lobby:get-players-list');
    socket.on('lobby:players-list', (players: PlayerListItem[]) => {
      if (!player) {
        throw new Error('Player does not exist, something went wrong');
      }

      setPlayersList(players.filter((p) => p.name !== player.name));
      console.log('Players list updated:', players);
    });

    // update when new player joins
    socket.on('lobby:update-players-list', (newPlayer: PlayerListItem) => {
      setPlayersList((prevList) => [...prevList, newPlayer]);
    });

    // assign role
    socket.once('player:role-assigned', (role: Role) => {
      setRoleAssigned(role);
    });

    socket.on('lobby:villagers-list', (villagers) => {
      setVillagersList(villagers);
    });

    return () => {
      socket.off('lobby:update-players-list');
      socket.off('lobby:players-list');
      socket.off('lobby:villagers-list');
      socket.off('lobby:update-players-list');
      socket.off('player:role-assigned');
    };
  }, [player]);

  const getPlayerNameFromSid = (socketId: string) => {
    const foundPlayer = villagersList.find((p) => p.socketId === socketId);
    if (!foundPlayer) {
      throw new Error(
        `Player with socketId ${socketId} not found in villagers list`
      );
    }
    return foundPlayer.name;
  };

  return {
    playersList,
    roleAssigned,
    villagersList,
    getPlayerNameFromSid,
  };
}
