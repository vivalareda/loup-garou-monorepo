import { create } from 'zustand';

type ModalType = 'confirm' | 'selection';

type ModalData = {
  type: ModalType;
  title: string;
  data: string[];
  selectionCount?: number;
  // biome-ignore lint/suspicious/noExplicitAny: <params are generic>
  onConfirm?: (...args: any[]) => any;
};

type ModalStore = {
  type: ModalType | null;
  modalData: ModalData | null;
  isOpen: boolean;
  closeModal: () => void;
  openModal: (data: ModalData) => void;
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
