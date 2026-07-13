import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'unrecoverable';

type ConnectionStore = {
  status: ConnectionStatus;
  /** The last recovery attempt failed: the previous session is gone. */
  recoveryFailed: boolean;
  setStatus: (status: ConnectionStatus) => void;
  setRecoveryFailed: (failed: boolean) => void;
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'connected',
  recoveryFailed: false,
  setStatus: (status) => set({ status }),
  setRecoveryFailed: (failed) => set({ recoveryFailed: failed }),
}));
