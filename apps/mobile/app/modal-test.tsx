import { Text, TouchableOpacity, View } from 'react-native';
import { GlobalModal } from '@/components/global-modal';
import { useModalStore } from '@/hooks/useModalStore';

export default function ModalTestScreen() {
  const { openModal } = useModalStore();

  const testWerewolfModal = () => {
    openModal({
      type: 'selection',
      title: 'Choose your target',
      data: [
        'socket-id-1',
        'socket-id-2',
        'socket-id-3',
        'socket-id-4',
        'socket-id-5',
      ],
      werewolfModal: true,
      onConfirm: (selection) => {
        console.log('Werewolf voted for:', selection);
      },
    });
  };

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 p-6">
      <Text className="mb-8 text-2xl font-bold text-gray-800">
        Modal Testing
      </Text>

      <View className="w-full max-w-sm space-y-4">
        <TouchableOpacity
          className="rounded-lg bg-red-600 p-4"
          onPress={testWerewolfModal}
        >
          <Text className="text-center text-lg font-semibold text-white">
            🐺 Test Werewolf Modal
          </Text>
        </TouchableOpacity>

        {/* Future modals can be added here */}
        <View className="mt-8 rounded-lg bg-yellow-100 p-4">
          <Text className="text-center text-sm text-yellow-800">
            More modal tests will be added here for Cupid, Seer, Witch, etc.
          </Text>
        </View>
      </View>

      <GlobalModal />
    </View>
  );
}
