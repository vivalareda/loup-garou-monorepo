import type { GameEndResult } from '@repo/types';
import { Text, TouchableOpacity, View } from 'react-native';
import { socket } from '@/utils/sockets';

const ROLE_LABELS: Record<string, string> = {
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
        <View className="mt-8 w-full rounded-2xl border border-slate-500/40 bg-slate-900/40 p-4">
          <Text className="text-center text-lg font-bold text-white">
            {result.winningFaction === 'werewolves'
              ? 'Les Loups-Garous ont gagné'
              : 'Les Villageois ont gagné'}
          </Text>

          <View className="mt-4">
            {result.players.map((revealed) => (
              <View
                className="flex-row items-center justify-between py-1"
                key={revealed.socketId}
              >
                <Text className="text-base text-slate-200">
                  {revealed.isAlive ? '🙂' : '💀'} {revealed.name}
                </Text>
                <Text className="text-base font-semibold text-slate-300">
                  {revealed.role
                    ? (ROLE_LABELS[revealed.role] ?? revealed.role)
                    : '?'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <TouchableOpacity
        accessibilityLabel="Rejouer une partie"
        accessibilityRole="button"
        className="mt-8 rounded-xl bg-slate-200/90 px-10 py-4"
        onPress={() => socket.emit('game:restart')}
      >
        <Text className="text-lg font-bold text-slate-900">Rejouer</Text>
      </TouchableOpacity>
    </View>
  );
}
