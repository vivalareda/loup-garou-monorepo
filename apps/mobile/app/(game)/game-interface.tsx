import {
  type GamePlayer,
  getRoleDescription,
  isGamePlayer,
  type PlayerListItem,
} from '@repo/types';
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { type ReactNode, useCallback, useEffect } from 'react';
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCardFlip } from '@/hooks/use-card-flip';
import { useGameStore } from '@/hooks/use-game-store';
import { type ModalState, useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import {
  handleWitchHealChoice,
  handleWitchPoisonChoice,
  type WitchEmit,
} from '@/hooks/witch-actions';
import { socket } from '@/utils/sockets';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.8;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

type OpenModalType = Extract<ModalState, { open: true }>['type'];

/** Everything the module-level modal presenters need from the component. */
type ModalPresentContext = {
  player: GamePlayer;
  playersList: PlayerListItem[];
  villagersList: PlayerListItem[];
  openModal: ReturnType<(typeof useModalStore)['getState']>['openModal'];
  closeModal: () => void;
  emitWitch: WitchEmit;
  setWaitingForPlayers: (waiting: boolean) => void;
  loverModalData: ReactNode;
  witchHealModalData: ReactNode;
};

/** SIDs of every listed player except the local one. */
function otherPlayerSids(ctx: ModalPresentContext) {
  return ctx.playersList
    .filter((p) => p.socketId !== ctx.player.socketId)
    .map((p) => p.socketId);
}

async function loverHapticAlert() {
  await new Promise((resolve) => setTimeout(resolve, 1000));
  console.log('promised resolved, sending haptics');
  try {
    await impactAsync(ImpactFeedbackStyle.Heavy);
    console.log('Haptic feedback triggered');
  } catch (error) {
    console.error('Error triggering haptic feedback', error);
  }
}

async function presentLoverModal(ctx: ModalPresentContext) {
  await loverHapticAlert();
  ctx.openModal({
    type: 'confirm',
    title: 'Vous êtes amoureux !',
    data: ctx.loverModalData,
    buttonDelay: 7000,
    onConfirm: () => {
      ctx.setWaitingForPlayers(true);
      socket.emit('alert:lover-closed-alert');
    },
  });
}

function presentCupidModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Choisissez les amoureux',
    data: otherPlayerSids(ctx), // Cupid cannot pick themself
    selectionCount: 2,
    onConfirm: (selectedPlayers: string[]) => {
      ctx.setWaitingForPlayers(true);
      socket.emit('cupid:lovers-pick', selectedPlayers);
    },
  });
}

function presentWerewolfModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Choisissez votre victime',
    data: ctx.villagersList.map((p) => p.socketId),
    werewolfModal: true,
    hideConfirmButton: true,
  });
}

function presentWitchHealModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'yes-no',
    title: 'Voulez-vous sauver la victime?',
    data: ctx.witchHealModalData,
    onConfirm: (choice: string) => {
      // GlobalModal passes the scalar "yes" / "no" for a yes-no modal,
      // not a string[] — sendWitchHeal compares the whole string.
      ctx.setWaitingForPlayers(true);
      handleWitchHealChoice(ctx.emitWitch, ctx.closeModal, choice);
    },
  });
}

function presentWitchPoisonModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Choisissez une victime à empoisonner',
    data: otherPlayerSids(ctx), // The witch cannot poison herself
    selectionCount: 1,
    onConfirm: (selectedPlayer: string) => {
      ctx.setWaitingForPlayers(true);
      handleWitchPoisonChoice(ctx.emitWitch, ctx.closeModal, selectedPlayer);
    },
    onSkip: () => {
      ctx.setWaitingForPlayers(true);
      handleWitchPoisonChoice(ctx.emitWitch, ctx.closeModal, null);
    },
    skipLabel: 'Ne pas empoisonner',
  });
}

function presentHunterModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Choisissez votre victime',
    data: otherPlayerSids(ctx), // The hunter cannot shoot himself
    selectionCount: 1,
    onConfirm: (selectedPlayerSid: string) => {
      console.log('selected data is', selectedPlayerSid);
      ctx.setWaitingForPlayers(true);
      socket.emit('hunter:killed-player', selectedPlayerSid);
    },
  });
}

function presentDayVoteModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Qui voulez-vous éliminer?',
    data: otherPlayerSids(ctx), // No self-votes
    selectionCount: 1,
    onConfirm: (selectedPlayer: string) => {
      ctx.setWaitingForPlayers(true);
      socket.emit('day:player-voted', selectedPlayer);
    },
  });
}

/**
 * Role/liveness guard per modal type: only the player the prompt is meant
 * for may see it (a stale or misdirected event must not open another
 * player's action modal).
 */
function isModalAllowed(type: OpenModalType, player: GamePlayer) {
  switch (type) {
    case 'LOVER':
    case 'DAY-VOTE':
      return true;
    case 'CUPID':
      return player.role === 'CUPID';
    case 'WEREWOLVES':
      return player.role === 'WEREWOLF';
    case 'WITCH-HEAL':
    case 'WITCH-POISON':
      return player.role === 'WITCH' && player.isAlive;
    case 'HUNTER':
      return player.role === 'HUNTER';
    default:
      throw new Error(`Unknown modal type: ${type satisfies never}`);
  }
}

function presentModalForState(type: OpenModalType, ctx: ModalPresentContext) {
  switch (type) {
    case 'LOVER':
      presentLoverModal(ctx);
      break;
    case 'CUPID':
      presentCupidModal(ctx);
      break;
    case 'WEREWOLVES':
      presentWerewolfModal(ctx);
      break;
    case 'WITCH-HEAL':
      presentWitchHealModal(ctx);
      break;
    case 'WITCH-POISON':
      presentWitchPoisonModal(ctx);
      break;
    case 'HUNTER':
      presentHunterModal(ctx);
      break;
    case 'DAY-VOTE':
      presentDayVoteModal(ctx);
      break;
    default:
      throw new Error(`Unknown modal type: ${type satisfies never}`);
  }
}

export default function GameInterface() {
  const { player } = usePlayerStore();
  const {
    playersList,
    villagersList,
    currentPhase,
    nightDeaths,
    dayVoteTie,
    isWaitingForPlayers,
    setWaitingForPlayers,
    getPlayerNameFromSid,
    werewolvesVictim,
  } = useGameStore();
  const { openModal, closeModal, modalState } = useModalStore();
  const { isRevealed, flipCard, animations } = useCardFlip();

  // Bridge the typed socket to the loose WitchEmit so the witch decisions
  // stay pure and unit-testable (the socket.io singleton throws on import in
  // tests when the backend URL env var is missing).
  const emitWitch = useCallback<WitchEmit>(
    (event, ...args) => (socket.emit as unknown as WitchEmit)(event, ...args),
    []
  );

  // Socket listeners (game events + store listeners) are mounted once in
  // app/(game)/_layout.tsx so they outlive this screen; refresh the roster
  // when the interface appears
  useEffect(() => {
    socket.emit('lobby:get-players-list');
  }, []);

  const getWitchHealModalData = useCallback((victimName: string | null) => {
    return (
      <View className="items-center justify-center py-4">
        <View className="mb-4 rounded-2xl border-2 border-red-400 bg-gradient-to-b from-red-900/20 to-slate-800/50 p-6 shadow-lg">
          <View className="items-center">
            <Text className="mb-2 text-sm font-medium uppercase tracking-wide text-red-300">
              Victime des Loups-Garous
            </Text>
            <View className="mb-3 h-px w-16 bg-red-400" />
            <Text className="text-2xl font-bold text-white">
              {victimName ?? 'Inconnu'}
            </Text>
            {victimName && (
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
  }, []);

  /** Resolve the werewolf victim SID to a display name. The victim may be
   * the witch herself (werewolves can target the witch), and `playersList`
   * excludes the current player, so fall back to the local player's name
   * rather than throwing. */
  const resolveVictimName = useCallback(
    (victimSid: string | null): string | null => {
      if (!victimSid) {
        return null;
      }
      if (victimSid === player?.socketId) {
        return player?.name ?? victimSid;
      }
      try {
        return getPlayerNameFromSid(victimSid);
      } catch {
        return victimSid;
      }
    },
    [player, getPlayerNameFromSid]
  );

  const getPublicPlayerName = useCallback(
    (socketId: string): string => {
      if (socketId === player?.socketId) {
        return player.name;
      }
      try {
        return getPlayerNameFromSid(socketId);
      } catch {
        return 'Joueur inconnu';
      }
    },
    [player, getPlayerNameFromSid]
  );

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
    if (!(player && isGamePlayer(player) && modalState.open)) {
      return;
    }

    if (!isModalAllowed(modalState.type, player)) {
      closeModal();
      return;
    }

    presentModalForState(modalState.type, {
      player,
      playersList,
      villagersList,
      openModal,
      closeModal,
      emitWitch,
      setWaitingForPlayers,
      loverModalData: getLoverModalData(),
      witchHealModalData: getWitchHealModalData(
        resolveVictimName(werewolvesVictim)
      ),
    });
  }, [
    modalState,
    player,
    playersList,
    villagersList,
    openModal,
    closeModal,
    getLoverModalData,
    getWitchHealModalData,
    resolveVictimName,
    emitWitch,
    setWaitingForPlayers,
    werewolvesVictim,
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
          <Text className="mt-2 text-center text-sm font-semibold uppercase tracking-wide text-blue-300">
            Phase: {currentPhase.replace(/_/g, ' ')}
          </Text>
          {isWaitingForPlayers && (
            <Text className="mt-2 text-center text-sm text-amber-200">
              En attente des autres joueurs...
            </Text>
          )}
        </View>

        {(nightDeaths.length > 0 || dayVoteTie.length > 0) && (
          <View className="mb-6 w-full rounded-2xl border border-slate-700 bg-slate-800/70 p-4">
            {nightDeaths.length > 0 && (
              <View>
                <Text className="text-center text-sm font-semibold uppercase tracking-wide text-red-300">
                  Victimes de la nuit
                </Text>
                {nightDeaths.map((death) => (
                  <Text
                    className="mt-2 text-center text-base text-slate-100"
                    key={`${death.playerId}-${death.cause}`}
                  >
                    {death.playerName || getPublicPlayerName(death.playerId)} (
                    {death.cause})
                  </Text>
                ))}
              </View>
            )}

            {dayVoteTie.length > 0 && (
              <View className={nightDeaths.length > 0 ? 'mt-4' : undefined}>
                <Text className="text-center text-sm font-semibold uppercase tracking-wide text-yellow-300">
                  Egalite du vote
                </Text>
                <Text className="mt-2 text-center text-base text-slate-100">
                  {dayVoteTie.join(', ')}: personne ne meurt.
                </Text>
              </View>
            )}
          </View>
        )}

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
