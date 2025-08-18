import type { GamePlayer, Player, Role } from '@repo/types';
import { create } from 'zustand';

type PlayerStore = {
  player: Player | null;
  setPlayer: (player: Player | null) => void;
  updateRole: (role: Role) => void;
};

export const usePlayerStore = create<PlayerStore>((set) => ({
  player: null,
  setPlayer: (player) => set({ player }),
  updateRole: (role) =>
    set((state) => {
      if (!state.player) {
        return state;
      }

      const player: GamePlayer = {
        type: 'game',
        name: state.player.name,
        sid: state.player.sid,
        isAlive: true,
        role,
      };

      return {
        player,
      };
    }),
}));
