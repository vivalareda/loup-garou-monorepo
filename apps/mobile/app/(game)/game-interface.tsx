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
  ActivityIndicator,
  Animated,
  Dimensions,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Avatar, Backdrop, Banner, Button, Eyebrow } from '@/components/ui';
import { useCardFlip } from '@/hooks/use-card-flip';
import { useGameStore } from '@/hooks/use-game-store';
import { type ModalState, useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import {
  handleWitchHealChoice,
  handleWitchPoisonChoice,
  type WitchEmit,
} from '@/hooks/witch-actions';
import { ROLES } from '@/lib/game-labels';
import { palette } from '@/lib/palette';
import { socket } from '@/utils/sockets';

// The witch decisions take their emit as a parameter so they stay pure and
// unit-testable (the socket singleton throws on import in tests when the
// backend URL env var is missing).
const emitWitch: WitchEmit = socket.emit.bind(socket);

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.72;
const CARD_HEIGHT = CARD_WIDTH * 1.35;

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
  seerResultModalData: ReactNode;
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
    confirmLabel: 'Compris',
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
    confirmLabel: 'Unir les amoureux',
    onConfirm: (selectedPlayers: string[]) => {
      ctx.setWaitingForPlayers(true);
      socket.emit('cupid:lovers-pick', selectedPlayers);
    },
  });
}

function presentSeerModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Qui voulez-vous sonder ?',
    data: otherPlayerSids(ctx),
    selectionCount: 1,
    confirmLabel: 'Sonder',
    onConfirm: (selectedPlayer: string) => {
      socket.emit('seer:picked-player', selectedPlayer);
    },
  });
}

function presentSeerResultModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'confirm',
    title: 'Votre vision',
    data: ctx.seerResultModalData,
    onConfirm: () => {
      ctx.setWaitingForPlayers(true);
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
    title: 'Voulez-vous sauver la victime ?',
    data: ctx.witchHealModalData,
    confirmLabel: 'Sauver',
    declineLabel: 'Laisser mourir',
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
    confirmLabel: 'Empoisonner',
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
    title: 'Emportez quelqu’un avec vous',
    data: otherPlayerSids(ctx), // The hunter cannot shoot himself
    selectionCount: 1,
    confirmLabel: 'Tirer',
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
    title: 'Qui voulez-vous éliminer ?',
    data: otherPlayerSids(ctx), // No self-votes
    selectionCount: 1,
    confirmLabel: 'Voter',
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
    case 'SEER':
    case 'SEER-RESULT':
      return player.role === 'SEER' && player.isAlive;
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
    case 'SEER':
      presentSeerModal(ctx);
      break;
    case 'SEER-RESULT':
      presentSeerResultModal(ctx);
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
  const { player, isAlive } = usePlayerStore();

  const {
    playersList,
    villagersList,
    setWaitingForPlayers,
    getPlayerNameFromSid,
    werewolvesVictim,
    seerVision,
    countdown,
    actionError,
    setActionError,
    loverPartnerName,
  } = useGameStore();

  const { openModal, closeModal, modalState } = useModalStore();
  const { isRevealed, flipCard, animations } = useCardFlip();

  // Socket listeners (game events + store listeners) are mounted once in
  // app/(game)/_layout.tsx so they outlive this screen; refresh the roster
  // when the interface appears
  useEffect(() => {
    socket.emit('lobby:get-players-list');
  }, []);

  useEffect(() => {
    if (!actionError) {
      return;
    }

    const timer = setTimeout(() => setActionError(null), 6000);

    return () => clearTimeout(timer);
  }, [actionError, setActionError]);

  const isDiscussionActive = countdown?.phase === 'DAY-DISCUSSION';

  const getWitchHealModalData = useCallback((victimName: string | null) => {
    return (
      <View className="w-full items-center gap-4">
        <View className="w-full items-center rounded-2xl border border-blood/50 bg-blood/15 p-5">
          <Eyebrow className="text-blood-300">Victime des loups-garous</Eyebrow>
          <Text className="mt-2 text-2xl font-bold text-moon-100">
            {victimName ?? 'Personne cette nuit'}
          </Text>
        </View>
        <Text className="text-center text-sm text-ink-300">
          🧪 Votre potion de guérison ne sert qu'une fois.
        </Text>
      </View>
    );
  }, []);

  /** Resolve the werewolf victim SID to a display name. The victim may be
   * the witch herself (werewolves can target the witch), and `playersList`
   * excludes the current player, so check the local player first. */
  const resolveVictimName = useCallback(
    (victimSid: string | null): string | null => {
      if (!victimSid) {
        return null;
      }

      if (victimSid === player?.socketId) {
        return player?.name ?? victimSid;
      }

      return getPlayerNameFromSid(victimSid);
    },
    [player, getPlayerNameFromSid]
  );

  const getSeerResultModalData = useCallback(() => {
    if (!seerVision) {
      return null;
    }

    const role = ROLES[seerVision.role];

    return (
      <View className="items-center gap-2">
        <Text className="text-6xl">{role.emblem}</Text>
        <Text className="mt-2 text-lg text-ink-200">
          {seerVision.playerName} est
        </Text>
        <Text className="text-3xl font-bold text-moon">{role.label}</Text>
      </View>
    );
  }, [seerVision]);

  const getLoverModalData = useCallback(() => {
    return (
      <View className="my-5 items-center justify-center">
        <View className="h-48 w-48 items-center justify-center">
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
        {loverPartnerName && (
          <Text className="mt-2 text-center text-lg text-ink-200">
            Vous aimez{' '}
            <Text className="font-bold text-rose">{loverPartnerName}</Text>
            {'\n'}Si l'un de vous meurt, l'autre meurt aussi.
          </Text>
        )}
      </View>
    );
  }, [loverPartnerName]);

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
      seerResultModalData: getSeerResultModalData(),
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
    getSeerResultModalData,
    resolveVictimName,
    setWaitingForPlayers,
    werewolvesVictim,
  ]);

  if (!player) {
    return (
      <Backdrop>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={palette.moon.DEFAULT} />
        </View>
      </Backdrop>
    );
  }

  if (!isGamePlayer(player)) {
    return null;
  }

  const role = ROLES[player.role];

  return (
    <Backdrop>
      <View className="flex-1 px-6">
        <View className="flex-row items-center gap-3 pt-2">
          <Avatar dead={!isAlive} name={player.name} size={40} />
          <View>
            <Eyebrow>Joueur</Eyebrow>
            <Text className="text-lg font-bold text-moon-100">
              {player.name}
            </Text>
          </View>
        </View>

        {/* The secret role card: face down until tapped, then flips back */}
        <View className="flex-1 items-center justify-center">
          <Pressable
            accessibilityHint="Montre votre rôle quelques secondes"
            accessibilityLabel="Votre carte de rôle"
            accessibilityRole="button"
            disabled={isRevealed}
            onPress={flipCard}
            style={{ width: CARD_WIDTH, height: CARD_HEIGHT }}
          >
            <Animated.View
              className="absolute inset-0 items-center justify-center overflow-hidden rounded-[28px] border border-moon/30 bg-ink-800"
              style={{
                transform: [{ rotateY: animations.frontInterpolate }],
                opacity: animations.frontOpacity,
                backfaceVisibility: 'hidden',
              }}
            >
              <View className="h-28 w-28 rounded-full bg-moon/90" />
              <Text className="mt-8 text-xl font-bold text-moon-100">
                Votre rôle
              </Text>
              <Text className="mt-2 px-8 text-center text-sm text-ink-300">
                Cachez l'écran, puis touchez la carte pour la retourner
              </Text>
            </Animated.View>

            <Animated.View
              className="absolute inset-0 items-center justify-center rounded-[28px] border border-moon bg-ink-900 p-6"
              style={{
                transform: [{ rotateY: animations.backInterpolate }],
                opacity: animations.backOpacity,
                backfaceVisibility: 'hidden',
              }}
            >
              <Text className="text-7xl">{role.emblem}</Text>
              <Text className="mt-4 text-3xl font-bold text-moon">
                {role.label}
              </Text>
              <View className="my-4 h-px w-16 bg-moon/40" />
              <Text className="text-center text-base leading-6 text-ink-200">
                {getRoleDescription(player.role)}
              </Text>
            </Animated.View>
          </Pressable>
        </View>

        {/* Only what the player can act on; the narrator tells the rest */}
        <View className="gap-3 pb-4">
          {actionError && <Banner tone="error">{actionError}</Banner>}
          {isAlive && isDiscussionActive && (
            <Button
              label="Passer au vote"
              onPress={() => socket.emit('day:start-vote')}
            />
          )}
          {isAlive && !isDiscussionActive && (
            <Text className="text-center text-sm text-ink-400">
              Posez votre téléphone, il vibrera quand ce sera à vous.
            </Text>
          )}
        </View>
      </View>
    </Backdrop>
  );
}
