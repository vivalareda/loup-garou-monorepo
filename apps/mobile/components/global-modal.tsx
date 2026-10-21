import { clsx } from 'clsx';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { type ModalData, useModalStore } from '@/hooks/use-modal-store';
import { palette } from '@/lib/theme';
import { socket } from '@/utils/sockets';

// Shared empty selection, so derived `selection` stays referentially stable
// across renders and doesn't churn the callbacks that depend on it.
const NO_SELECTION: string[] = [];

function renderChildren(children: React.ReactNode) {
  return (
    <View className="my-5 w-full items-center justify-center">{children}</View>
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

  const getListItemStyle = (item: string) => {
    const selected = isSelected(item);
    const disabled = isItemDisabled(item);

    return clsx('mb-2 rounded-xl border p-3', {
      'border-[#E6E7D4] bg-[#E6E7D4]/20': selected,
      'border-[#3A4E56] bg-[#142028]/60 opacity-40': disabled,
      'border-[#3A4E56] bg-[#142028]/80': !(selected || disabled),
    });
  };

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
      <View className="mb-4 max-h-60">
        <FlatList
          data={modalData.data}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={getListItemStyle(item)}
              disabled={isItemDisabled(item)}
              onPress={() => handleSelection(item)}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  style={{
                    color: isSelected(item) ? palette.moon : palette.snow,
                    fontFamily: isSelected(item)
                      ? 'Outfit_600SemiBold'
                      : 'Outfit_400Regular',
                    fontSize: 16,
                  }}
                >
                  {getPlayerNameFromSid(item)}
                </Text>
                {isSelected(item) && (
                  <Text style={{ color: palette.moon, fontSize: 16 }}>✓</Text>
                )}
              </View>
              {modalData.werewolfModal && (
                <Text
                  className="mt-1 text-sm"
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_400Regular',
                  }}
                >
                  {getVoteCount(item)}/{totalWerewolves}
                </Text>
              )}
            </TouchableOpacity>
          )}
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
          <TouchableOpacity
            className="flex-1 rounded-xl px-4 py-3"
            onPress={handleNoClick}
            style={{ backgroundColor: palette.danger }}
          >
            <Text
              className="text-center"
              style={{
                color: palette.snow,
                fontFamily: 'Outfit_600SemiBold',
              }}
            >
              Non
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 rounded-xl px-4 py-3"
            onPress={handleYesClick}
            style={{ backgroundColor: palette.success }}
          >
            <Text
              className="text-center"
              style={{
                color: palette.snow,
                fontFamily: 'Outfit_600SemiBold',
              }}
            >
              Oui
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="mt-4 flex-row gap-3">
        {modalData.onSkip && (
          <TouchableOpacity
            className="flex-1 rounded-xl px-4 py-3"
            onPress={handleSkip}
            style={{
              borderWidth: 1,
              borderColor: palette.panelBorder,
              backgroundColor: 'transparent',
            }}
          >
            <Text
              className="text-center"
              style={{
                color: palette.moon,
                fontFamily: 'Outfit_600SemiBold',
              }}
            >
              {modalData.skipLabel ?? 'Passer'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="flex-1 rounded-xl px-4 py-3"
          disabled={isButtonDisabled()}
          onPress={handleModalClose}
          style={{
            backgroundColor: isButtonDisabled()
              ? 'rgba(230, 231, 212, 0.28)'
              : palette.moon,
            opacity: isButtonDisabled() ? 0.7 : 1,
          }}
        >
          <Text
            className="text-center"
            style={{
              color: palette.ink,
              fontFamily: 'Outfit_600SemiBold',
            }}
          >
            {modalData.confirmLabel ?? 'Confirmer'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={closeModal}
      transparent
      visible={isOpen}
    >
      <View
        className="flex-1 items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(8, 14, 18, 0.72)' }}
      >
        <TouchableWithoutFeedback>
          <View
            className="w-full max-w-sm p-6"
            style={{
              borderRadius: 20,
              backgroundColor: palette.forest,
              borderWidth: 1,
              borderColor: palette.panelBorder,
            }}
          >
            {modalData.title && (
              <Text
                className="mb-4 text-center text-xl"
                style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
              >
                {modalData.title}
              </Text>
            )}

            {Array.isArray(modalData.data)
              ? renderPlayerList()
              : renderChildren(modalData.data)}

            {renderButton()}
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}
