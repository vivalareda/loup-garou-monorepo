import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';

export default function WaitingRoom() {
  const { playersList, roleAssigned, initializeSocketListeners } =
    useGameStore();
  const { player } = usePlayerStore();
  const router = useRouter();

  useEffect(() => {
    initializeSocketListeners();
  }, [initializeSocketListeners]);

  useEffect(() => {
    if (roleAssigned) {
      router.push('/(game)/game-interface');
    }
  }, [router, roleAssigned]);

  if (!player) {
    throw new Error('Player not found in waiting room');
  }

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-slate-600 pb-24">
      <View className="w-3/4 gap-36 space-y-5 pt-32">
        <Text className="text-center text-white">
          {playersList.length === 0
            ? `Vous etes le seul dans la salle d'attente, attendez que d'autres joueurs vous rejoignent`
            : `${playersList
                .filter((p) => p.name !== player.name)
                .map((p) => p.name)
                .join(', \n')}, \n attendent avec vous`}
        </Text>
      </View>
    </SafeAreaView>
  );
}
