import { getRoleDescription, isGamePlayer } from '@repo/types';

import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useCallback, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCardFlip } from '@/hooks/use-card-flip';
import { useGameEvents } from '@/hooks/use-game-events';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

export default function GameInterface() {
  const { player } = usePlayerStore();
  const {
    playersList,
    villagersList,
    initializeSocketListeners,
    cleanupSocketListeners,
  } = useGameStore();
  const { modalState, werewolvesVictim } = useGameEvents();
  const { openModal } = useModalStore();
  const { isRevealed, flipCard, animations } = useCardFlip();

  // Initialize socket listeners when component mounts
  useEffect(() => {
    socket.emit('lobby:get-players-list');
    initializeSocketListeners();
    return cleanupSocketListeners;
  }, [initializeSocketListeners, cleanupSocketListeners]);

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

  const getWitchModalData = useCallback(() => {
    return (
      <View className="items-center justify-center py-4">
        <View className="mb-4 rounded-2xl border-2 border-red-400 bg-gradient-to-b from-red-900/20 to-slate-800/50 p-6 shadow-lg">
          <View className="items-center">
            <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-red-300">
              Victime des Loups-Garous
            </Text>
            <View className="mb-3 h-px w-16 bg-red-400" />
            <Text className="text-2xl font-bold text-white">
              {werewolvesVictim}
            </Text>
            {werewolvesVictim && (
              <View className="mt-3 rounded-full bg-red-500/20 px-3 py-1">
                <Text className="text-xs text-red-300">💀 En danger</Text>
              </View>
            )}
          </View>
        </View>

        <View className="items-center">
          <View className="mb-2 h-12 w-8 rounded-full bg-gradient-to-b from-green-400 to-green-600 shadow-lg">
            <View className="mx-auto mt-1 h-2 w-6 rounded-full bg-green-300" />
          </View>
          <Text className="text-xs font-medium text-green-400">
            Potion de Guérison
          </Text>
        </View>
      </View>
    );
  }, [werewolvesVictim]);

  const getLoverModalData = useCallback(() => {
    return (
      <View className="my-5 h-48 w-48 items-center justify-center">
        <LottieView
          autoPlay
          loop
          source={require('../../assets/cupid-animation.json')}
          style={{
            width: 192,
            height: 192,
          }}
        />
      </View>
    );
  }, []);

  useEffect(() => {
    const loverHapticAlert = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('promised resolved, sending haptics');
      try {
        await impactAsync(ImpactFeedbackStyle.Heavy);
        console.log('Haptic feedback triggered');
      } catch (error) {
        console.error('Error triggering haptic feedback', error);
      }
    };

    const handleLoverModal = async () => {
      await loverHapticAlert();
      openModal({
        type: 'confirm',
        title: 'Vous êtes amoureux !',
        data: getLoverModalData(),
        buttonDelay: 5000,
        onConfirm: () => {
          socket.emit('alert:lover-closed-alert');
        },
      });
    };

    const handleCupidModal = () => {
      openModal({
        type: 'selection',
        title: 'Choisissez les amoureux',
        data: playersList.map((p) => p.name),
        selectionCount: 2,
        onConfirm: (selectedPlayers: string[]) => {
          const loversSid = selectedPlayers.map((name) => {
            return getPlayerSid(name);
          });
          socket.emit('cupid:lovers-pick', loversSid);
        },
      });
    };

    const handleWitchHealModal = () => {
      openModal({
        type: 'yes-no',
        title: 'Voulez-vous sauver la victime?',
        data: getWitchModalData(),
        onConfirm: (choice: string[]) => {
          if (choice[0] === 'yes') {
            socket.emit('witch:healed-player');
          } else {
            socket.emit('witch:skipped-heal');
          }
        },
      });
    };

    const handleWerewolfModal = () => {
      openModal({
        type: 'selection',
        title: 'Choisissez votre victime',
        data: villagersList.map((p) => p.socketId),
        werewolfModal: true,
        hideConfirmButton: true,
      });
    };

    const handleWitchKillModal = () => {
      openModal({
        type: 'selection',
        title: 'Choisissez une victime',
        data: playersList.map((p) => p.name),
        selectionCount: 1,
        onConfirm: (selectedPlayer: string) => {
          socket.emit('witch:poisoned-player', selectedPlayer);
        },
      });
    };

    const handleDayVoteModal = () => {
      openModal({
        type: 'selection',
        title: 'Qui voulez-vous éliminer?',
        data: playersList.map((p) => p.name),
        selectionCount: 1,
        onConfirm: (selectedPlayer: string) => {
          socket.emit('day:player-voted', selectedPlayer);
        },
      });
    };

    if (!(player && isGamePlayer(player) && modalState.open)) {
      return;
    }

    switch (modalState.type) {
      case 'LOVER':
        handleLoverModal();
        break;

      case 'CUPID':
        if (player.role !== 'CUPID') {
          return;
        }
        handleCupidModal();
        break;

      case 'WEREWOLVES':
        if (player.role !== 'WEREWOLF') {
          return;
        }
        handleWerewolfModal();
        break;

      case 'WITCH-HEAL':
        handleWitchHealModal();
        break;

      case 'WITCH-POISON':
        handleWitchKillModal();
        break;

      case 'DAY-VOTE':
        handleDayVoteModal();
        break;

      default:
        throw new Error(`Unknown modal type: ${modalState satisfies never}`);
    }
  }, [
    modalState,
    player,
    playersList,
    villagersList,
    openModal,
    getPlayerSid,
    getLoverModalData,
    getWitchModalData,
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
                transform: [{ rotateY: animations.frontInterpolate }],
                opacity: animations.frontOpacity,
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
                transform: [{ rotateY: animations.backInterpolate }],
                opacity: animations.backOpacity,
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
