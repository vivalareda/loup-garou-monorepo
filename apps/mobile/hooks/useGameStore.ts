import type { Player } from '@repo/types';
import { create } from 'zustand';

type GameState = {
  players: Player[];
  addPlayers: (player: Player) => void;
};

export const useGameStore = create<GameState>((set) => ({
  players: [],
  addPlayers: (player) =>
    set((state) => ({
      players: [...state.players, player],
    })),
}));
