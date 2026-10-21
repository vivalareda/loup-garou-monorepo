import type { GameEndResult, Role } from '@repo/types';
import { Text, View } from 'react-native';
import { Panel, PrimaryButton } from '@/components/ui/primary-button';
import { palette } from '@/lib/theme';
import { socket } from '@/utils/sockets';

export const ROLE_LABELS: Record<Role, string> = {
  WEREWOLF: 'Loup-Garou',
  VILLAGER: 'Villageois',
  WITCH: 'Sorcière',
  CUPID: 'Cupidon',
  HUNTER: 'Chasseur',
  SEER: 'Voyante',
};

/**
 * End-of-game reveal shared by the winner and loser screens: the winning
 * faction, every player's role and fate, and the play-again control (any
 * player may trigger the server reset).
 */
export function EndGamePanel({ result }: { result: GameEndResult | null }) {
  return (
    <View className="w-full items-center">
      {result && (
        <View className="mt-8 w-full">
          <Panel>
            <Text
              className="text-center text-lg"
              style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
            >
              {result.winningFaction === 'werewolves'
                ? 'Les Loups-Garous ont gagné'
                : 'Les Villageois ont gagné'}
            </Text>

            <View className="mt-4">
              {result.players.map((revealed) => (
                <View
                  className="flex-row items-center justify-between py-2"
                  key={revealed.socketId}
                  style={{
                    borderBottomWidth: 1,
                    borderBottomColor: 'rgba(230, 231, 212, 0.08)',
                  }}
                >
                  <Text
                    className="text-base"
                    style={{
                      color: revealed.isAlive ? palette.snow : palette.moonDim,
                      fontFamily: 'Outfit_500Medium',
                    }}
                  >
                    {revealed.name}
                    {!revealed.isAlive ? ' · mort' : ''}
                  </Text>
                  <Text
                    className="text-base"
                    style={{
                      color: palette.moonDim,
                      fontFamily: 'Outfit_400Regular',
                    }}
                  >
                    {revealed.role ? ROLE_LABELS[revealed.role] : '?'}
                  </Text>
                </View>
              ))}
            </View>
          </Panel>
        </View>
      )}

      <View className="mt-8 w-56">
        <PrimaryButton
          accessibilityLabel="Rejouer une partie"
          label="Rejouer"
          onPress={() => socket.emit('game:restart')}
        />
      </View>
    </View>
  );
}
