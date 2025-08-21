import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useWerewolfVotes } from '@/hooks/use-werewolves-votes';
import { useModalStore } from '@/hooks/useModalStore';

export function GlobalModal() {
  const { isOpen, modalData, closeModal } = useModalStore();
  const { votes, sendVote } = useWerewolfVotes();
  const [selection, setSelection] = useState<string[]>([]);
  const [isDelayActive, setIsDelayActive] = useState(false);

  useEffect(() => {
    if (modalData?.buttonDelay) {
      setIsDelayActive(true);
      const timer = setTimeout(() => {
        setIsDelayActive(false);
      }, modalData.buttonDelay);

      return () => clearTimeout(timer);
    }
  }, [modalData?.buttonDelay]);

  if (!(isOpen && modalData)) {
    return null;
  }

  const isSelected = (item: string) => selection.includes(item);

  const getListItemStyle = (item: string) => {
    const selected = isSelected(item);
    const disabled = isItemDisabled(item);

    return clsx('mb-2 rounded-lg border-2 p-3', {
      'border-blue-500 bg-blue-100': selected,
      'border-gray-300 bg-gray-50 opacity-40': disabled,
      'border-gray-300 bg-gray-50': !(selected || disabled),
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

  const handleModalClose = () => {
    if (modalData.onConfirm) {
      modalData.onConfirm(selection);
    }
    closeModal();
  };

  const handleSelection = (item: string) => {
    if (isSelected(item)) {
      setSelection(selection.filter((i) => i !== item));
      if (modalData.werewolfModal) {
        sendVote(item);
      }
    } else {
      setSelection([...selection, item]);
    }
  };

  const getVoteCount;
  (item: string) => {};

  const renderPlayerList = () => {
    if (!(modalData.data && Array.isArray(modalData.data))) {
      return null;
    }

    return (
      <View className="mb-4 max-h-60">
        <FlatList
          data={modalData.data}
          keyExtractor={(item) => `player-${item}`}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={getListItemStyle(item)}
              disabled={isItemDisabled(item)}
              onPress={() => handleSelection(item)}
            >
              <View className="flex-row items-center justify-between">
                <Text
                  className={`${isSelected(item) ? 'text-blue-800 font-medium' : 'text-gray-800'}`}
                >
                  {item}
                </Text>
                {isSelected(item) && <Text className="text-blue-600">✓</Text>}
              </View>
              {modalData.werewolfModal && (
                <Text style={{ fontSize: 14 }}>
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

  console.log(`is button disabled? ${isButtonDisabled()}`);
  console.log(`selection count: ${selection.length}`);

  const renderChildren = (children: React.ReactNode) => {
    return (
      <View className="my-5 h-48 w-48 items-center justify-center">
        {children}
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
      <View className="flex-1 items-center justify-center bg-black/50">
        <TouchableWithoutFeedback>
          <View className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-2xl">
            {modalData.title && (
              <Text className="mb-4 text-center text-lg font-semibold text-gray-900">
                {modalData.title}
              </Text>
            )}

            {Array.isArray(modalData.data)
              ? renderPlayerList()
              : renderChildren(modalData.data)}

            <TouchableOpacity
              className={clsx(
                'mt-4 rounded-lg px-4 py-2',
                isButtonDisabled() ? 'bg-gray-500 opacity-50' : 'bg-blue-500'
              )}
              disabled={isButtonDisabled()}
              onPress={handleModalClose}
            >
              <Text className="py-2 text-center font-medium text-white">
                Confirm Selection
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </View>
    </Modal>
  );
}
