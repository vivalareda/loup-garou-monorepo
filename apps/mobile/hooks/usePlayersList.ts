import type { Role } from '@repo/types';
import { useEffect, useState } from 'react';
import { socket } from '@/utils/sockets';

export function usePlayersList() {
  const [playersList, setPlayersList] = useState<string[]>([]);
  const [roleAssigned, setRoleAssigned] = useState<Role | null>(null);

  useEffect(() => {
    // initial player list
    socket.emit('lobby:get-players-list');
    socket.once('lobby:players-list', (players: string[]) => {
      setPlayersList(players);
    });

    // update when new player joins
    socket.on('lobby:update-players-list', (newPlayer: string) => {
      setPlayersList((prevList) => [...prevList, newPlayer]);
    });

    // assign role
    socket.once('player:role-assigned', (role: Role) => {
      setRoleAssigned(role);
    });

    return () => {
      socket.removeAllListeners('lobby:update-players-list');
    };
  }, []);

  return {
    playersList,
    roleAssigned,
  };
}
