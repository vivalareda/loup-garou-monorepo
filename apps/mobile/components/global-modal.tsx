import clsx from 'clsx';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useModalStore } from '@/hooks/useModalStore';

export function GlobalModal() {
  const { isOpen, modalData, closeModal } = useModalStore();
  const [selection, setSelection] = useState<string[]>([]);
  const limitReached = modalData?.selectionCount
    ? selection.length >= modalData.selectionCount
    : false;

  if (!(isOpen && modalData)) {
    return null;
  }

  const isSelected = (item: string) => selection.includes(item);

  const getListItemStyle = (item: string) => {
    const selected = isSelected(item);
    const disabled = limitReached && !selected;

    return clsx('mb-2 rounded-lg border-2 p-3', {
      'border-blue-500 bg-blue-100': selected,
      'border-gray-300 bg-gray-50 opacity-40': disabled,
      'border-gray-300 bg-gray-50': !(selected || disabled),
    });
  };

  const handleModalClose = () => {
    console.log('Modal data', modalData);
    if (modalData.onConfirm) {
      modalData.onConfirm(selection);
    }
    closeModal();
  };

  const handleSelection = (item: string) => {
    if (isSelected(item)) {
      setSelection(selection.filter((i) => i !== item));
    } else {
      setSelection([...selection, item]);
    }
  };

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
              disabled={limitReached && !isSelected(item)}
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
            </TouchableOpacity>
          )}
          showsVerticalScrollIndicator={false}
        />
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

            {renderPlayerList()}

            <TouchableOpacity
              className={clsx(
                'mt-4 rounded-lg px-4 py-2',
                limitReached ? 'bg-blue-500' : 'bg-gray-500 opacity-50'
              )}
              disabled={!limitReached}
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
