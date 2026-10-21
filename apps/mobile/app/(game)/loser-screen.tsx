import { ScrollView, Text, View } from 'react-native';
import { EndGamePanel } from '@/components/end-game-panel';
import { ForestScreen } from '@/components/ui/forest-screen';
import { Panel } from '@/components/ui/primary-button';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { palette } from '@/lib/theme';

export default function LoserScreen() {
  const { player } = usePlayerStore();
  const { gameResult } = useGameStore();

  return (
    <ForestScreen solid>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <View className="w-full max-w-md items-center">
          <Text
            className="mb-2 text-center text-xs uppercase tracking-[3px]"
            style={{ color: palette.danger, fontFamily: 'Outfit_500Medium' }}
          >
            Fin de partie
          </Text>
          <Text
            className="mb-3 text-center text-4xl"
            style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
          >
            Défaite
          </Text>
          <Text
            className="mb-6 text-center text-xl"
            style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
          >
            {player?.name}
          </Text>

          <Panel>
            <Text
              className="text-center text-base"
              style={{ color: palette.snow, fontFamily: 'Outfit_400Regular' }}
            >
              Votre équipe a perdu la partie.
            </Text>
          </Panel>

          <EndGamePanel result={gameResult} />
        </View>
      </ScrollView>
    </ForestScreen>
  );
}
