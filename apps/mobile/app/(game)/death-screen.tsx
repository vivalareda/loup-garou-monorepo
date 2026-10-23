import { Text, View } from 'react-native';
import { Avatar, Backdrop, Banner } from '@/components/ui';
import { usePlayerStore } from '@/hooks/use-player-store';

export default function DeathScreen() {
  const { player } = usePlayerStore();

  return (
    <Backdrop variant="defeat">
      <View className="flex-1 items-center justify-center gap-6 px-6">
        {player && <Avatar dead name={player.name} size={88} />}
        <View className="items-center">
          <Text className="text-3xl font-bold text-blood-300">
            Vous avez été éliminé
          </Text>
          {player && (
            <Text className="mt-2 text-lg text-ink-200">{player.name}</Text>
          )}
        </View>
        <Banner tone="info">
          Vous pouvez suivre la fin de la partie — mais les morts ne parlent pas
          🤫
        </Banner>
      </View>
    </Backdrop>
  );
}
