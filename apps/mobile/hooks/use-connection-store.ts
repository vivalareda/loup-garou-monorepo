import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'unrecoverable';

type ConnectionStore = {
  status: ConnectionStatus;
  /** The last recovery attempt failed: the previous session is gone. */
  recoveryFailed: boolean;
  /** The room the socket is connected to (or connecting to), if any. */
  roomCode: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setRecoveryFailed: (failed: boolean) => void;
  setRoomCode: (code: string | null) => void;
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'connected',
  recoveryFailed: false,
  roomCode: null,
  setStatus: (status) => set({ status }),
  setRecoveryFailed: (failed) => set({ recoveryFailed: failed }),
  setRoomCode: (code) => set({ roomCode: code }),
}));
