import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EndGamePanel } from '@/components/end-game-panel';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';

export default function LoserScreen() {
  const { player } = usePlayerStore();
  const { gameResult } = useGameStore();

  return (
    <SafeAreaView className="flex-1 bg-red-900">
      <ScrollView contentContainerClassName="flex-grow items-center justify-center px-6 py-8">
        <View className="w-full items-center">
          <Text className="mb-4 text-8xl">😞</Text>

          <View className="mb-4 items-center">
            <Text className="mb-2 text-3xl font-bold text-red-400">
              Défaite
            </Text>
            <Text className="text-xl text-slate-300">{player?.name}</Text>
          </View>

          <View className="rounded-2xl border-2 border-red-400/30 bg-red-900/20 px-6 py-4">
            <Text className="text-center text-lg font-medium text-red-400">
              Votre équipe a perdu la partie
            </Text>
          </View>

          <EndGamePanel result={gameResult} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
