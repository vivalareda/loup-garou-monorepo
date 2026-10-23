import type { GameEndResult } from '@repo/types';
import { clsx } from 'clsx';
import { ScrollView, Text, View } from 'react-native';
import { Avatar, Backdrop, Button, Eyebrow } from '@/components/ui';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { ROLES } from '@/lib/game-labels';
import { socket } from '@/utils/sockets';

/** Every player's role and fate, revealed once the game is over. */
function RoleReveal({ result }: { result: GameEndResult }) {
  return (
    <View className="w-full gap-2 rounded-3xl border border-ink-700 bg-ink-900/80 p-4">
      <Eyebrow className="mb-1">Les rôles</Eyebrow>
      {result.players.map((revealed) => {
        const role = revealed.role ? ROLES[revealed.role] : null;

        return (
          <View className="flex-row items-center gap-3" key={revealed.socketId}>
            <Avatar dead={!revealed.isAlive} name={revealed.name} size={32} />
            <Text
              className={clsx(
                'flex-1 text-base',
                revealed.isAlive ? 'text-moon-100' : 'text-ink-400 line-through'
              )}
            >
              {revealed.name}
            </Text>
            <Text className="text-base font-semibold text-ink-200">
              {role ? `${role.emblem} ${role.label}` : '?'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/**
 * The winner and loser screens: which side won, every player's role and
 * fate, and the play-again control (any player may trigger the server
 * reset).
 */
export function EndGameScreen({ won }: { won: boolean }) {
  const { player } = usePlayerStore();
  const { gameResult } = useGameStore();

  const winners =
    gameResult?.winningFaction === 'werewolves'
      ? 'Les loups-garous ont dévoré le village'
      : 'Le village a vaincu les loups-garous';

  return (
    <Backdrop variant={won ? 'victory' : 'defeat'}>
      <ScrollView contentContainerClassName="flex-grow items-center justify-center gap-6 px-6 py-8">
        <View className="items-center">
          <Text className="text-7xl">{won ? '🏆' : '🥀'}</Text>
          <Text
            className={clsx(
              'mt-4 text-4xl font-bold',
              won ? 'text-moon' : 'text-blood-300'
            )}
          >
            {won ? 'Victoire !' : 'Défaite'}
          </Text>
          {gameResult && (
            <Text className="mt-2 text-center text-base text-ink-200">
              {winners}
            </Text>
          )}
          {player && (
            <Text className="mt-1 text-sm text-ink-400">{player.name}</Text>
          )}
        </View>

        {gameResult && <RoleReveal result={gameResult} />}

        <Button
          className="self-stretch"
          label="Rejouer"
          onPress={() => socket.emit('game:restart')}
        />
      </ScrollView>
    </Backdrop>
  );
}
