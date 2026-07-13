import { beforeEach, describe, expect, it } from 'vitest';

import { useModalStore } from '@/hooks/use-modal-store';

describe('useModalStore', () => {
  beforeEach(() => {
    useModalStore.getState().closeModal();
  });

  it('starts closed', () => {
    expect(useModalStore.getState().isOpen).toBe(false);
    expect(useModalStore.getState().modalState).toEqual({ open: false });
    expect(useModalStore.getState().modalData).toBeNull();
  });

  it('setModalState opens the witch poison modal', () => {
    useModalStore
      .getState()
      .setModalState({ type: 'WITCH-POISON', open: true });

    expect(useModalStore.getState().modalState).toEqual({
      type: 'WITCH-POISON',
      open: true,
    });
  });

  it('setModalState opens the witch heal modal', () => {
    useModalStore.getState().setModalState({ type: 'WITCH-HEAL', open: true });

    expect(useModalStore.getState().modalState).toEqual({
      type: 'WITCH-HEAL',
      open: true,
    });
  });

  it('closeModal resets isOpen, modalState, and modalData', () => {
    useModalStore.getState().setModalState({ type: 'WITCH-HEAL', open: true });
    useModalStore.getState().openModal({
      type: 'yes-no',
      title: 'heal?',
      data: ['x'],
    });

    // Sanity: opening populated the store.
    expect(useModalStore.getState().isOpen).toBe(true);
    expect(useModalStore.getState().modalData).not.toBeNull();

    useModalStore.getState().closeModal();

    expect(useModalStore.getState().isOpen).toBe(false);
    expect(useModalStore.getState().modalState).toEqual({ open: false });
    expect(useModalStore.getState().modalData).toBeNull();
  });

  it('openModal stores onSkip/skipLabel so the poison modal can skip', () => {
    const onSkip = () => {
      // identity only — the test asserts the same reference is stored
    };
    useModalStore.getState().openModal({
      type: 'selection',
      title: 'poison?',
      data: ['sid-1'],
      selectionCount: 1,
      onSkip,
      skipLabel: 'Ne pas empoisonner',
    });

    const modalData = useModalStore.getState().modalData;
    expect(modalData?.onSkip).toBe(onSkip);
    expect(modalData?.skipLabel).toBe('Ne pas empoisonner');
  });
});
