import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlayerStore } from '@/hooks/use-player-store';

export default function WinnerScreen() {
  const { player } = usePlayerStore();

  return (
    <SafeAreaView className="flex-1 bg-green-900">
      <View className="flex-1 items-center justify-center px-6">
        <View className="items-center">
          <Text className="mb-4 text-8xl">🎉</Text>

          <View className="mb-8 items-center">
            <Text className="mb-2 text-3xl font-bold text-green-400">
              Victoire !
            </Text>
            <Text className="text-xl text-slate-300">{player?.name}</Text>
          </View>

          <View className="rounded-2xl border-2 border-green-400/30 bg-green-900/20 px-6 py-4">
            <Text className="text-center text-lg font-medium text-green-400">
              Votre équipe a gagné la partie !
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
