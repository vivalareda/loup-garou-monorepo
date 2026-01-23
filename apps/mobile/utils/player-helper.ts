import type { PlayerIdentity } from '@repo/types';

export const getPlayerSid = (playersList: PlayerIdentity[], name: string) => {
  const foundPlayer = playersList.find((p) => p.name === name);
  if (!foundPlayer) {
    throw new Error(`Player with name ${name} not found in players list`);
  }
  return foundPlayer.sid;
};
