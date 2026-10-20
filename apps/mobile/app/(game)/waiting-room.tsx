import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '@repo/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { formatRoomCode } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

/**
 * The host's lobby controls: how many players the game starts at (it
 * starts by itself once that many joined), and starting right away with
 * the players already in, which sets the count to the headcount.
 */
function HostControls({
  joinedCount,
  requiredPlayerCount,
}: {
  joinedCount: number;
  requiredPlayerCount: number;
}) {
  const setCount = (count: number) => {
    socket.emit('lobby:set-player-count', count);
  };
  const canLower = requiredPlayerCount > Math.max(MIN_PLAYER_COUNT, joinedCount);
  const canRaise = requiredPlayerCount < MAX_PLAYER_COUNT;
  const canStartNow =
    joinedCount >= MIN_PLAYER_COUNT && joinedCount < requiredPlayerCount;

  return (
    <View className="items-center gap-4">
      <View className="flex-row items-center gap-6">
        <TouchableOpacity
          className={`rounded-lg px-5 py-2 ${canLower ? 'bg-slate-200/50' : 'bg-slate-400/20'}`}
          disabled={!canLower}
          onPress={() => setCount(requiredPlayerCount - 1)}
        >
          <Text className="text-2xl font-bold text-white">−</Text>
        </TouchableOpacity>
        <Text className="text-white">{requiredPlayerCount} joueurs</Text>
        <TouchableOpacity
          className={`rounded-lg px-5 py-2 ${canRaise ? 'bg-slate-200/50' : 'bg-slate-400/20'}`}
          disabled={!canRaise}
          onPress={() => setCount(requiredPlayerCount + 1)}
        >
          <Text className="text-2xl font-bold text-white">+</Text>
        </TouchableOpacity>
      </View>
      {canStartNow && (
        <TouchableOpacity
          className="rounded-lg bg-slate-200/50 px-6 py-3"
          onPress={() => setCount(joinedCount)}
        >
          <Text className="font-bold text-white">
            Lancer à {joinedCount} joueurs
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function WaitingRoom() {
  const {
    playersList,
    roleAssigned,
    requiredPlayerCount,
    hostSocketId,
    actionError,
  } = useGameStore();
  const { player } = usePlayerStore();
  const roomCode = useConnectionStore((state) => state.roomCode);
  const router = useRouter();

  useEffect(() => {
    if (roleAssigned) {
      router.push('/(game)/game-interface');
    }
  }, [router, roleAssigned]);

  if (!player) {
    // game:restarted resets the player store a tick before its
    // router.replace('/join') unmounts this screen — render nothing for
    // that frame instead of crashing the whole app.
    return null;
  }

  // playersList excludes the local player
  const joinedCount = playersList.length + 1;
  const isHost = hostSocketId !== null && hostSocketId === player.socketId;

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-slate-600 pb-24">
      <View className="w-3/4 gap-16 space-y-5 pt-32">
        {roomCode && (
          <View className="items-center">
            <Text className="text-white">Code de la partie</Text>
            <Text className="text-4xl font-bold tracking-widest text-white">
              {formatRoomCode(roomCode)}
            </Text>
          </View>
        )}
        {requiredPlayerCount !== null && (
          <Text className="text-center text-3xl font-bold text-white">
            {joinedCount}/{requiredPlayerCount} joueurs
          </Text>
        )}
        {isHost && requiredPlayerCount !== null && (
          <HostControls
            joinedCount={joinedCount}
            requiredPlayerCount={requiredPlayerCount}
          />
        )}
        {actionError && (
          <Text className="text-center font-semibold text-red-300">
            {actionError}
          </Text>
        )}
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
