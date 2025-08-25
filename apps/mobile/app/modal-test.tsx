import LottieView from 'lottie-react-native';
import { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { GlobalModal } from '@/components/global-modal';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayersList } from '@/hooks/use-players-list';

export default function ModalTestScreen() {
  const { openModal } = useModalStore();
  const { playersList, villagersList } = usePlayersList();

  const testWerewolfModal = () => {
    openModal({
      type: 'selection',
      title: 'Choose your target',
      data:
        villagersList.length > 0
          ? villagersList.map((p) => p.socketId)
          : [
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

  const testWitchKillModal = () => {
    // Use real player data if available, otherwise mock data
    const availablePlayers =
      playersList.length > 0
        ? playersList.map((p) => p.socketId)
        : [
            'socket-id-1',
            'socket-id-2',
            'socket-id-3',
            'socket-id-4',
            'socket-id-5',
          ];

    openModal({
      type: 'selection',
      title: 'Sorcière - Choisissez votre victime',
      selectionCount: 1,
      data: availablePlayers,
      onConfirm: (selection) => {
        console.log(`🧙 Witch poisoned: ${selection}`);
      },
    });
  };

  const getWitchModalData = () => {
    const werewolvesVictim = 'Alice';

    return (
      <View className="items-center justify-center py-6">
        {/* Victim Information Card */}
        <View className="mb-8 w-full rounded-2xl border-2 border-red-400 bg-gradient-to-b from-red-900/20 to-slate-800/50 p-6 shadow-lg">
          <View className="items-center">
            <Text className="mb-3 text-sm font-medium uppercase tracking-wide text-red-300">
              Victime des Loups-Garous
            </Text>
            <View className="mb-4 h-px w-20 bg-red-400" />
            <Text className="mb-4 text-3xl font-bold text-black">
              {werewolvesVictim}
            </Text>
          </View>
        </View>

        {/* Healing Potion Visual */}
        <View className="items-center">
          <View className="mb-3 h-16 w-10 rounded-full bg-gradient-to-b from-green-400 to-green-600 shadow-lg">
            <View className="mx-auto mt-2 h-3 w-8 rounded-full bg-green-300" />
            <View className="mx-auto mt-1 h-2 w-6 rounded-full bg-green-200/80" />
          </View>
          <Text className="text-sm font-semibold text-green-600">
            Potion de Guérison
          </Text>
          <Text className="mt-1 text-xs text-gray-500">
            Voulez-vous sauver cette personne ?
          </Text>
        </View>
      </View>
    );
  };

  const getLoverModalData = useCallback(() => {
    return (
      <View className="my-5 h-48 w-48 items-center justify-center">
        <LottieView
          autoPlay
          loop
          source={require('../assets/cupid-animation.json')}
          style={{
            width: 192,
            height: 192,
          }}
        />
      </View>
    );
  }, []);

  const testLoverModal = () => {
    openModal({
      type: 'confirm',
      title: 'Vous êtes amoureux !',
      data: getLoverModalData(),
      buttonDelay: 8000,
      onConfirm: () => {
        console.log('💕 Lover acknowledged they are in love');
      },
    });
  };

  const testWitchHealModal = () => {
    openModal({
      type: 'yes-no',
      title: 'Sorcière - Potion de Guérison',
      data: getWitchModalData(),
      onConfirm: (result) => {
        console.log(`Witch chose: ${result}`);
        if (result === 'yes') {
          console.log('🧙 Witch healed the victim!');
        } else {
          console.log('🧙 Witch chose not to heal.');
        }
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

        <TouchableOpacity
          className="rounded-lg bg-green-600 p-4"
          onPress={testWitchHealModal}
        >
          <Text className="text-center text-lg font-semibold text-white">
            🧙 Test Witch Heal Modal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-lg bg-purple-600 p-4"
          onPress={testWitchKillModal}
        >
          <Text className="text-center text-lg font-semibold text-white">
            🧙 Test Witch Poison Modal
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="rounded-lg bg-pink-600 p-4"
          onPress={testLoverModal}
        >
          <Text className="text-center text-lg font-semibold text-white">
            💕 Test Lover Alert Modal
          </Text>
        </TouchableOpacity>

        {/* Future modals can be added here */}
        <View className="mt-8 rounded-lg bg-yellow-100 p-4">
          <Text className="text-center text-sm text-yellow-800">
            More modal tests will be added here for Cupid, Seer, etc.
          </Text>
        </View>
      </View>

      <GlobalModal />
    </View>
  );
}
