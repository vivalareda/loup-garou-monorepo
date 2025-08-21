/** biome-ignore-all lint/suspicious/noExplicitAny: <using genercis> */
import type React from 'react';
import { create } from 'zustand';

type ModalType = 'confirm' | 'selection';

type ModalData = {
  type: ModalType;
  title: string;
  data: string[] | React.ReactNode;
  selectionCount?: number;
  buttonDelay?: number;
  werewolfModal?: boolean;
  onConfirm?: (...args: any[]) => any;
  disableButtonCondition?: (...args: any[]) => any;
};

type ModalStore = {
  type: ModalType | null;
  modalData: ModalData | null;
  isOpen: boolean;
  selectionCount?: number;
  buttonDelay?: number;
  syncSelection?: boolean;
  werewolfModal?: boolean;
  closeModal: () => void;
  openModal: (data: ModalData) => void;
  disableButtonCondition?: () => void;
};

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  modalData: null,
  isOpen: false,
  closeModal: () => {
    set({ modalData: null, isOpen: false });
  },
  openModal: (modalData: ModalData) => set({ modalData, isOpen: true }),
}));
