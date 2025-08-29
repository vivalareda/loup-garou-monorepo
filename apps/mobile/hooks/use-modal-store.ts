/** biome-ignore-all lint/suspicious/noExplicitAny: <using genercis> */
import type React from 'react';
import { create } from 'zustand';

export type ModalState =
  | { type: 'CUPID'; open: true }
  | { type: 'LOVER'; open: true }
  | { type: 'WEREWOLVES'; open: true }
  | { type: 'WITCH-HEAL'; open: true }
  | { type: 'WITCH-POISON'; open: true }
  | { type: 'HUNTER'; open: true }
  | { type: 'DAY-VOTE'; open: true }
  | { open: false };

type ModalType = 'confirm' | 'selection' | 'yes-no';

type ModalData = {
  type: ModalType;
  title: string;
  data: string[] | React.ReactNode;
  selectionCount?: number;
  buttonDelay?: number;
  werewolfModal?: boolean;
  autoConfirm?: boolean;
  hideConfirmButton?: boolean;
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
  autoConfirm?: boolean;
  hideConfirmButton?: boolean;
  modalState: ModalState;
  setModalState: (state: ModalState) => void;
  closeModal: () => void;
  openModal: (data: ModalData) => void;
  disableButtonCondition?: () => void;
};

export const useModalStore = create<ModalStore>((set) => ({
  type: null,
  modalData: null,
  isOpen: false,
  modalState: {
    open: false,
  },
  closeModal: () => {
    set({
      modalData: null,
      isOpen: false,
      modalState: {
        open: false,
      },
    });
  },
  openModal: (modalData: ModalData) =>
    set({
      modalData,
      isOpen: true,
    }),
  setModalState(state) {
    set({
      modalState: state,
    });
  },
}));
