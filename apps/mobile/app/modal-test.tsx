import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { GlobalModal } from '@/components/global-modal';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';

export default function ModalTestScreen() {
  const { openModal } = useModalStore();
  const { setPlayersList, getPlayerNameFromSid } = useGameStore();
  const [lastSelection, setLastSelection] = useState<string>('');
  const [selectionHistory, setSelectionHistory] = useState<
    Array<{ timestamp: string; selection: string; playerName: string }>
  >([]);

  const mockPlayers = [
    { name: 'Alice', sid: 'ZjQxMjRmN2UtNmY2Ni00' },
    { name: 'Bob', sid: 'OGI3YWJkYzEtNzIyOC00' },
    { name: 'Charlie', sid: 'NWU4ZGZhNzItMzk5MS00' },
    { name: 'Diana', sid: 'MjA3YjQ5YjQtZGY5Mi00' },
    { name: 'Eve', sid: 'YTFiY2RlZjAtMjM4OS00' },
  ];

  // Populate game store with mock data so GlobalModal can resolve socket IDs
  useEffect(() => {
    setPlayersList(mockPlayers);
  }, [setPlayersList]); // setPlayersList is stable from Zustand

  // Helper function to log selection with socket ID verification
  const logSelectionWithVerification = useCallback(
    (selection: string, action: string) => {
      try {
        const playerName = getPlayerNameFromSid(selection);
        const logEntry = {
          timestamp: new Date().toLocaleTimeString(),
          selection,
          playerName,
        };

        setLastSelection(
          `${action}: ${playerName} (${selection.slice(-6)}...)`
        );
        setSelectionHistory((prev) => [logEntry, ...prev.slice(0, 4)]); // Keep last 5 entries

        console.log(
          `✅ ${action} - Socket ID: ${selection}, Player: ${playerName}`
        );
      } catch (error) {
        console.log(`❌ ${action} - Invalid Socket ID: ${selection}`, error);
        setLastSelection(
          `${action}: Invalid Socket ID (${selection.slice(-6)}...)`
        );
      }
    },
    [getPlayerNameFromSid]
  );

  const getMockSids = () => mockPlayers.map((p) => p.sid);

  const testWerewolfModal = () => {
    const availableTargets = getMockSids();

    console.log('🐺 Testing Werewolf Modal with socket IDs:', availableTargets);

    openModal({
      type: 'selection',
      title: 'Choose your target',
      data: availableTargets,
      werewolfModal: true,
      onConfirm: (selection) => {
        logSelectionWithVerification(selection, 'Werewolf Vote');
      },
    });
  };

  const testWitchKillModal = () => {
    const availablePlayers = getMockSids();

    console.log(
      '🧙 Testing Witch Poison Modal with socket IDs:',
      availablePlayers
    );

    openModal({
      type: 'selection',
      title: 'Sorcière - Choisissez votre victime',
      selectionCount: 1,
      data: availablePlayers,
      onConfirm: (selection) => {
        logSelectionWithVerification(selection, 'Witch Poison');
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
        setLastSelection('Lover Alert: Acknowledged');
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
        setLastSelection(`Witch Heal Decision: ${result}`);
      },
    });
  };

  const testCupidModal = () => {
    const availablePlayers = getMockSids();

    console.log('💘 Testing Cupid Modal with socket IDs:', availablePlayers);

    openModal({
      type: 'selection',
      title: 'Cupidon - Choisissez les amoureux',
      selectionCount: 2,
      data: availablePlayers,
      onConfirm: (selections) => {
        try {
          const lovers = Array.isArray(selections) ? selections : [selections];
          const loverNames = lovers.map((sid) => {
            try {
              return getPlayerNameFromSid(sid);
            } catch {
              return `Unknown (${sid})`;
            }
          });

          const logEntry = {
            timestamp: new Date().toLocaleTimeString(),
            selection: lovers.join(', '),
            playerName: loverNames.join(' & '),
          };

          setLastSelection(`Cupid Selection: ${loverNames.join(' & ')}`);
          setSelectionHistory((prev) => [logEntry, ...prev.slice(0, 4)]);

          console.log('💘 Cupid selected lovers:', loverNames, lovers);
        } catch (error) {
          console.log('❌ Cupid selection error:', error);
          setLastSelection('Cupid Selection: Error processing selection');
        }
      },
    });
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="mb-8 text-2xl font-bold text-gray-800">
          Modal Testing with Socket ID Verification
        </Text>

        {/* Socket ID Verification Display */}
        <View className="mb-6 w-full max-w-sm">
          <View className="mb-4 rounded-lg bg-blue-100 p-4">
            <Text className="mb-2 text-sm font-semibold text-blue-800">
              Mock Players ({mockPlayers.length})
            </Text>
            {mockPlayers.map((player) => (
              <Text className="text-xs text-blue-600" key={player.sid}>
                {player.name}: {player.sid}
              </Text>
            ))}
          </View>

          {lastSelection ? (
            <View className="mb-4 rounded-lg bg-green-100 p-3">
              <Text className="mb-1 text-sm font-semibold text-green-800">
                Last Selection:
              </Text>
              <Text className="text-xs text-green-700">{lastSelection}</Text>
            </View>
          ) : null}

          {selectionHistory.length > 0 && (
            <View className="mb-4 rounded-lg bg-gray-100 p-3">
              <Text className="mb-2 text-sm font-semibold text-gray-800">
                Selection History:
              </Text>
              {selectionHistory.map((entry) => (
                <Text
                  className="mb-1 text-xs text-gray-600"
                  key={`${entry.timestamp}-${entry.selection}`}
                >
                  {entry.timestamp}: {entry.playerName} (
                  {entry.selection.slice(-6)}...)
                </Text>
              ))}
            </View>
          )}
        </View>

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

          <TouchableOpacity
            className="rounded-lg bg-orange-600 p-4"
            onPress={testCupidModal}
          >
            <Text className="text-center text-lg font-semibold text-white">
              💘 Test Cupid Selection Modal
            </Text>
          </TouchableOpacity>

          {/* Future modals can be added here */}
          <View className="mt-8 rounded-lg bg-yellow-100 p-4">
            <Text className="text-center text-sm text-yellow-800">
              Test modals verify socket IDs work correctly by showing player
              names
            </Text>
          </View>
        </View>

        <GlobalModal />
      </View>
    </ScrollView>
  );
}
