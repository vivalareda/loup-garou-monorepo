import type { PlayerListItem, Role } from '@repo/types';
import { useEffect, useState } from 'react';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { socket } from '@/utils/sockets';

export function usePlayersList() {
  const [playersList, setPlayersList] = useState<PlayerListItem[]>([]);
  const [roleAssigned, setRoleAssigned] = useState<Role | null>(null);
  const [villagersList, setVillagersList] = useState<string[]>([]);
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

    // villager list when game starts
    socket.on('lobby:villagers-list', (villagers: string[]) => {
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

  const getVillagersList = () => {
    socket.emit('werewolf:get-villagers');
  };

  return {
    playersList,
    roleAssigned,
    villagersList,
    getVillagersList,
  };
}
