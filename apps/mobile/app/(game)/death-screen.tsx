import { Text, View } from 'react-native';
import { ForestScreen } from '@/components/ui/forest-screen';
import { Panel } from '@/components/ui/primary-button';
import { usePlayerStore } from '@/hooks/use-player-store';
import { palette } from '@/lib/theme';

export default function DeathScreen() {
  const { player } = usePlayerStore();

  return (
    <ForestScreen solid>
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md items-center">
          <Text
            className="mb-2 text-center text-xs uppercase tracking-[3px]"
            style={{ color: palette.danger, fontFamily: 'Outfit_500Medium' }}
          >
            Éliminé
          </Text>
          <Text
            className="mb-3 text-center text-4xl"
            style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
          >
            Vous êtes mort
          </Text>
          <Text
            className="mb-8 text-center text-xl"
            style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
          >
            {player?.name}
          </Text>

          <Panel>
            <Text
              className="text-center text-base leading-6"
              style={{ color: palette.snow, fontFamily: 'Outfit_400Regular' }}
            >
              Vous pouvez continuer à observer la partie en silence.
            </Text>
          </Panel>
        </View>
      </View>
    </ForestScreen>
  );
}
