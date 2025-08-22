import { getRoleDescription, isGamePlayer } from '@repo/types';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGameEvents } from '@/hooks/useGameEvents';
import { useModalStore } from '@/hooks/useModalStore';
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { usePlayersList } from '@/hooks/usePlayersList';
import { socket } from '@/utils/sockets';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

export default function GameInterface() {
  const { player } = usePlayerStore();
  const { playersList, villagersList } = usePlayersList();
  const { showModal, showLoversAlert } = useGameEvents();
  const { openModal } = useModalStore();
  const [isRevealed, setIsRevealed] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getPlayerSid = useCallback(
    (name: string) => {
      const foundPlayer = playersList.find((p) => p.name === name);
      if (!foundPlayer) {
        throw new Error(`Player with name ${name} not found in players list`);
      }
      return foundPlayer.socketId;
    },
    [playersList]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!(player && isGamePlayer(player))) {
      return;
    }

    if (showModal && player.role === 'CUPID') {
      openModal({
        type: 'selection',
        title: 'Choisissez les amoureux',
        data: playersList.map((p) => p.name),
        selectionCount: 2,
        onConfirm: (selectedPlayers: string[]) => {
          console.log('Selected lovers:', selectedPlayers);
          const loversSid = selectedPlayers.map((name) => {
            return getPlayerSid(name);
          });
          socket.emit('cupid:lovers-pick', loversSid);
        },
      });
    }

    if (showModal && player.role === 'CUPID') {
      openModal({
        type: 'selection',
        title: 'Qui sera votre victime',
        data: villagersList,
        selectionCount: 1,
      });
    }

    if (showLoversAlert) {
      openModal({
        type: 'confirm',
        title: 'Vous êtes amoureux !',
        data: (
          <LottieView
            autoPlay
            loop
            source={require('../../assets/cupid-animation.json')}
            style={{
              width: '100%',
              height: '100%',
              alignSelf: 'center',
            }}
          />
        ),
        buttonDelay: 8000,
        onConfirm: () => {
          socket.emit('alert:lover-closed-alert');
        },
      });
    }
  }, [
    showModal,
    villagersList,
    openModal,
    playersList,
    showLoversAlert,
    player,
    getPlayerSid,
  ]);

  if (!player) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-slate-900">
        <Text className="text-white">Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (!isGamePlayer(player)) {
    return null;
  }

  console.log(`player is: ${player.name}`);

  const flipCard = () => {
    if (isRevealed) {
      return;
    }

    setIsRevealed(true);

    Animated.spring(flipAnimation, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();

    timeoutRef.current = setTimeout(() => {
      Animated.spring(flipAnimation, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start(() => {
        setIsRevealed(false);
      });
    }, 2000);
  };

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <SafeAreaView className="flex-1 bg-slate-900">
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-8">
          <Text className="mt-2 text-center text-xl text-slate-300">
            Joueur: {player.name}
          </Text>
        </View>

        <View className="relative items-center justify-center">
          <TouchableOpacity
            className="relative"
            disabled={isRevealed}
            onPress={flipCard}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          >
            <Animated.View
              className="absolute inset-0 items-center justify-center rounded-3xl border-2 border-slate-700 bg-slate-800 shadow-2xl"
              style={{
                transform: [{ rotateY: frontInterpolate }],
                opacity: frontOpacity,
                backfaceVisibility: 'hidden',
              }}
            >
              <Text className="text-8xl text-slate-500">?</Text>
              <Text className="mt-4 px-6 text-center text-lg text-slate-400">
                Appuyez sur la carte pour révéler votre rôle
              </Text>
            </Animated.View>

            <Animated.View
              className="absolute inset-0 items-center justify-center rounded-3xl border-2 border-blue-500 bg-gradient-to-b from-blue-900 to-slate-800 p-6 shadow-2xl"
              style={{
                transform: [{ rotateY: backInterpolate }],
                opacity: backOpacity,
                backfaceVisibility: 'hidden',
              }}
            >
              <View className="items-center">
                <Text className="mb-4 text-2xl font-bold text-white">
                  {player.role}
                </Text>
                <View className="h-px w-20 bg-blue-400" />
                <Text className="mt-4 text-center text-base leading-6 text-slate-200">
                  {getRoleDescription(player.role)}
                </Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View className="mt-8">
          <Text className="text-center text-sm text-slate-500">
            {isRevealed
              ? 'La carte se cachera automatiquement dans 5 secondes'
              : 'Touchez la carte pour découvrir votre rôle'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
