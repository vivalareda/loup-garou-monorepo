import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { Avatar, Button } from '@/components/ui';
import { useGameStore } from '@/hooks/use-game-store';
import { type ModalData, useModalStore } from '@/hooks/use-modal-store';
import { socket } from '@/utils/sockets';

// Shared empty selection, so derived `selection` stays referentially stable
// across renders and doesn't churn the callbacks that depend on it.
const NO_SELECTION: string[] = [];

function renderChildren(children: React.ReactNode) {
  return (
    <View className="my-3 w-full items-center justify-center">{children}</View>
  );
}

export function GlobalModal() {
  const { isOpen, modalData, closeModal } = useModalStore();

  const {
    villagersList,
    playersList,
    getPlayerNameFromSid,
    werewolfVotes: votes,
    sendVote,
    isVotingComplete,
    resetVoting,
  } = useGameStore();

  // Selection and the confirm-button delay belong to the modal they were
  // made for. The store replaces modalData on every open and nulls it on
  // close, so tagging them with that object makes a new modal start with an
  // empty selection (a prior modal's picks can't leak into a later one and
  // submit a stale target) and its own delay.
  const [picked, setPicked] = useState<{
    modal: ModalData | null;
    items: string[];
  }>({ modal: null, items: [] });

  const selection = picked.modal === modalData ? picked.items : NO_SELECTION;

  const setSelection = (items: string[]) =>
    setPicked({ modal: modalData, items });

  const [delayElapsedFor, setDelayElapsedFor] = useState<ModalData | null>(
    null
  );

  const isDelayActive =
    Boolean(modalData?.buttonDelay) && delayElapsedFor !== modalData;

  const totalWerewolves = playersList.length - villagersList.length + 1;

  if (modalData?.data) {
    console.log(`Modal data is ${modalData.data}`);
  }

  const handleModalClose = useCallback(() => {
    if (modalData?.onConfirm) {
      if (modalData?.selectionCount === 1) {
        modalData.onConfirm(selection[0]); // Pass single item for single selection
      } else {
        modalData.onConfirm(selection); // Pass full array for multi-selection
      }
    }

    closeModal();
  }, [modalData, selection, closeModal]);

  const handleSkip = useCallback(() => {
    modalData?.onSkip?.();
    closeModal();
  }, [modalData, closeModal]);

  const handleYesClick = useCallback(() => {
    if (modalData?.onConfirm) {
      modalData.onConfirm('yes');
    }

    closeModal();
  }, [modalData, closeModal]);

  const handleNoClick = useCallback(() => {
    if (modalData?.onConfirm) {
      modalData.onConfirm('no');
    }

    closeModal();
  }, [modalData, closeModal]);

  useEffect(() => {
    if (!modalData?.buttonDelay) {
      return;
    }

    const timer = setTimeout(() => {
      setDelayElapsedFor(modalData);
    }, modalData.buttonDelay);

    return () => clearTimeout(timer);
  }, [modalData]);

  useEffect(() => {
    if (modalData?.werewolfModal && isVotingComplete) {
      resetVoting();
      handleModalClose();
    }
  }, [
    isVotingComplete,
    modalData?.werewolfModal,
    resetVoting,
    handleModalClose,
  ]);

  if (!(isOpen && modalData)) {
    return null;
  }

  const isSelected = (item: string) => selection.includes(item);

  const isItemDisabled = (item: string) => {
    if (modalData.selectionCount && !isSelected(item)) {
      return selection.length >= modalData.selectionCount;
    }

    return false;
  };

  const isButtonDisabled = () => {
    if (isDelayActive) {
      return true;
    }

    if (modalData.disableButtonCondition) {
      return modalData.disableButtonCondition(selection);
    }

    if (modalData.selectionCount) {
      return selection.length < modalData.selectionCount;
    }

    return false;
  };

  const handleSelection = (item: string) => {
    if (isSelected(item)) {
      setSelection(selection.filter((i) => i !== item));

      if (modalData.werewolfModal) {
        sendVote(socket, item);
      }

      return;
    }

    if (modalData.werewolfModal) {
      setSelection([item]);
      sendVote(socket, item);
    } else {
      setSelection([...selection, item]);
    }
  };

  const getVoteCount = (item: string) => {
    return votes[item] || 0;
  };

  const renderPlayerList = () => {
    if (!(modalData.data && Array.isArray(modalData.data))) {
      console.error('Modal data is not an array:', modalData.data);

      return null;
    }

    return (
      <View className="mb-2 max-h-80">
        {modalData.selectionCount && modalData.selectionCount > 1 && (
          <Text className="mb-3 text-center text-sm text-ink-300">
            {selection.length} / {modalData.selectionCount} sélectionnés
          </Text>
        )}
        <FlatList
          contentContainerClassName="gap-2"
          data={modalData.data}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const name = getPlayerNameFromSid(item);
            const selected = isSelected(item);

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  selected,
                  disabled: isItemDisabled(item),
                }}
                className={clsx(
                  'flex-row items-center gap-3 rounded-2xl border px-3 py-2.5',
                  selected
                    ? 'border-moon bg-moon/15'
                    : 'border-ink-700 bg-ink-900/70',
                  isItemDisabled(item) && 'opacity-40'
                )}
                disabled={isItemDisabled(item)}
                onPress={() => handleSelection(item)}
              >
                <Avatar name={name} size={34} />
                <Text
                  className={clsx(
                    'flex-1 text-base',
                    selected ? 'font-bold text-moon' : 'text-moon-100'
                  )}
                >
                  {name}
                </Text>
                {modalData.werewolfModal && (
                  <Text className="text-sm font-semibold text-blood-300">
                    🐺 {getVoteCount(item)}/{totalWerewolves}
                  </Text>
                )}
                {selected && <Text className="text-lg text-moon">✓</Text>}
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  };

  const renderButton = () => {
    if (modalData.hideConfirmButton) {
      return null;
    }

    if (modalData.type === 'yes-no') {
      return (
        <View className="mt-4 flex-row gap-3">
          <Button
            className="flex-1"
            label={modalData.declineLabel ?? 'Non'}
            onPress={handleNoClick}
            variant="secondary"
          />
          <Button
            className="flex-1"
            label={modalData.confirmLabel ?? 'Oui'}
            onPress={handleYesClick}
          />
        </View>
      );
    }

    return (
      <View className="mt-4 gap-2">
        <Button
          disabled={isButtonDisabled()}
          label={modalData.confirmLabel ?? 'Confirmer'}
          onPress={handleModalClose}
        />
        {modalData.onSkip && (
          <Button
            label={modalData.skipLabel ?? 'Passer'}
            onPress={handleSkip}
            variant="ghost"
          />
        )}
      </View>
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      statusBarTranslucent
      transparent
      visible={isOpen}
    >
      <View className="flex-1 justify-center bg-black/70 px-5">
        <View className="rounded-[28px] border border-ink-600 bg-ink-800 p-6">
          {modalData.title && (
            <Text className="mb-4 text-center text-xl font-bold text-moon-100">
              {modalData.title}
            </Text>
          )}

          {Array.isArray(modalData.data)
            ? renderPlayerList()
            : renderChildren(modalData.data)}

          {renderButton()}
        </View>
      </View>
    </Modal>
  );
}
