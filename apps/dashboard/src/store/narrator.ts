import { create } from 'zustand';

type NarratorStore = {
  /** This tab has registered as the game's narrator. */
  enabled: boolean;
  /** The clip playing right now, if any. */
  currentClip: string | null;
  setEnabled: (enabled: boolean) => void;
  setCurrentClip: (clip: string | null) => void;
};

export const useNarratorStore = create<NarratorStore>((set) => ({
  enabled: false,
  currentClip: null,
  setEnabled: (enabled) => set({ enabled }),
  setCurrentClip: (currentClip) => set({ currentClip }),
}));
