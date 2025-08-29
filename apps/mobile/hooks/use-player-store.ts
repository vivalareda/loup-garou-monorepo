import type { GamePlayer, Player, Role } from '@repo/types';
import { isGamePlayer } from '@repo/types';
import { create } from 'zustand';

type PlayerStore = {
  player: Player | null;
  isAlive: boolean;
  setPlayer: (player: Player | null) => void;
  setRole: (role: Role) => void;
  playerIsDead: () => void;
  getPlayerRole: () => Role;
};

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  player: null,
  isAlive: true,
  setPlayer: (player) => set({ player }),
  playerIsDead: () => set({ isAlive: false }),
  setRole: (role) =>
    set((state) => {
      if (!state.player) {
        return state;
      }

      const player: GamePlayer = {
        type: 'game',
        name: state.player.name,
        socketId: state.player.socketId,
        isAlive: true,
        role,
      };

      return {
        player,
      };
    }),

  getPlayerRole: () => {
    const { player } = get();
    if (!(player && isGamePlayer(player))) {
      throw new Error('player does not have a role yet');
    }
    return player.role;
  },
}));
