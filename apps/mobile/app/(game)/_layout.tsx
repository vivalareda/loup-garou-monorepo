import { useKeepAwake } from 'expo-keep-awake';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameEvents } from '@/hooks/use-game-events';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { socket } from '@/utils/sockets';

export default function GameLayout() {
  // A living-room game means phones lying on the table between turns:
  // never let the screen lock (and the socket die) on any game route
  useKeepAwake();

  // Game-level socket listeners live here, above the individual routes, so
  // a player routed to the death screen keeps receiving winner/loser
  // routing and the restart event
  useGameEvents();

  const {
    initializeSocketListeners,
    cleanupSocketListeners,
    pendingRedirect,
    setPendingRedirect,
  } = useGameStore();
  const { modalState } = useModalStore();
  const connectionStatus = useConnectionStore((state) => state.status);
  const router = useRouter();

  useEffect(() => {
    initializeSocketListeners();
    socket.emit('lobby:get-players-list');
    return cleanupSocketListeners;
  }, [initializeSocketListeners, cleanupSocketListeners]);

  // A death that arrived while a modal was open redirects once it closes
  useEffect(() => {
    if (!modalState.open && pendingRedirect) {
      router.replace('/death-screen');
      setPendingRedirect(false);
    }
  }, [router, pendingRedirect, modalState.open, setPendingRedirect]);

  return (
    <View className="flex-1">
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="waiting-room" />
        <Stack.Screen name="death-screen" />
        <Stack.Screen name="winner-screen" />
        <Stack.Screen name="loser-screen" />
        <Stack.Screen name="game-interface" />
      </Stack>
      {connectionStatus === 'reconnecting' && (
        <View className="absolute left-4 right-4 top-14 z-50 rounded-xl bg-amber-500/95 px-4 py-3 shadow-lg">
          <Text className="text-center font-semibold text-slate-900">
            Connexion perdue — reconnexion en cours…
          </Text>
        </View>
      )}
    </View>
  );
}
