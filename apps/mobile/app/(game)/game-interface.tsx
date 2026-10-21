import {
  type CountdownPhase,
  type GamePlayer,
  getRoleDescription,
  isGamePlayer,
  type PlayerListItem,
} from '@repo/types';
import { ImpactFeedbackStyle, impactAsync } from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ROLE_LABELS } from '@/components/end-game-panel';
import { Banner } from '@/components/ui/banner';
import { ForestScreen } from '@/components/ui/forest-screen';
import { Panel, PrimaryButton } from '@/components/ui/primary-button';
import { useCardFlip } from '@/hooks/use-card-flip';
import { useGameStore } from '@/hooks/use-game-store';
import { type ModalState, useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import {
  handleWitchHealChoice,
  handleWitchPoisonChoice,
  type WitchEmit,
} from '@/hooks/witch-actions';
import { palette } from '@/lib/theme';
import { socket } from '@/utils/sockets';

// The witch decisions take their emit as a parameter so they stay pure and
// unit-testable (the socket singleton throws on import in tests when the
// backend URL env var is missing).
const emitWitch: WitchEmit = socket.emit.bind(socket);

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
  seerResultModalData: ReactNode;
};

/** SIDs of every listed player except the local one. */
function otherPlayerSids(ctx: ModalPresentContext) {
  return ctx.playersList
    .filter((p) => p.socketId !== ctx.player.socketId)
    .map((p) => p.socketId);
}

const COUNTDOWN_LABELS: Partial<Record<CountdownPhase, string>> = {
  CUPID: 'Cupidon choisit',
  LOVERS: 'Les amoureux se découvrent',
  SEER: 'La voyante observe',
  WEREWOLF: 'Les loups-garous chassent',
  'WITCH-HEAL': 'La sorcière décide',
  'WITCH-POISON': 'La sorcière décide',
  'DAY-DISCUSSION': 'Discussion du village',
  DAY: 'Vote du village',
  HUNTER: 'Le chasseur vise',
};

function formatRemaining(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function PhaseCountdown({
  countdown,
}: {
  countdown: { phase: CountdownPhase; endsAt: number };
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(timer);
  }, []);

  const remaining = countdown.endsAt - now;

  if (remaining <= 0) {
    return null;
  }

  return (
    <Text
      className="mt-2 text-center text-sm"
      style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
    >
      {COUNTDOWN_LABELS[countdown.phase] ?? countdown.phase} —{' '}
      {formatRemaining(remaining)}
    </Text>
  );
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
    onConfirm: (selectedPlayers: string[]) => {
      ctx.setWaitingForPlayers(true);
      socket.emit('cupid:lovers-pick', selectedPlayers);
    },
  });
}

function presentSeerModal(ctx: ModalPresentContext) {
  ctx.openModal({
    type: 'selection',
    title: 'Qui voulez-vous sonder?',
    data: otherPlayerSids(ctx),
    selectionCount: 1,
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
    currentPhase,
    nightDeaths,
    dayVoteTie,
    isWaitingForPlayers,
    setWaitingForPlayers,
    getPlayerNameFromSid,
    werewolvesVictim,
    seerVision,
    countdown,
    phaseTimedOut,
    setPhaseTimedOut,
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
    if (!phaseTimedOut) {
      return;
    }

    const timer = setTimeout(() => setPhaseTimedOut(null), 8000);

    return () => clearTimeout(timer);
  }, [phaseTimedOut, setPhaseTimedOut]);

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
      <View className="items-center justify-center py-2">
        <View
          style={{
            width: '100%',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(196, 92, 74, 0.45)',
            backgroundColor: palette.dangerSoft,
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text
            className="mb-2 text-center text-xs uppercase tracking-[2px]"
            style={{ color: palette.danger, fontFamily: 'Outfit_500Medium' }}
          >
            Victime des loups-garous
          </Text>
          <View
            className="mx-auto mb-3 h-px w-14"
            style={{ backgroundColor: 'rgba(196, 92, 74, 0.55)' }}
          />
          <Text
            className="text-center text-2xl"
            style={{ color: palette.snow, fontFamily: 'Cinzel_700Bold' }}
          >
            {victimName ?? 'Inconnu'}
          </Text>
          {victimName ? (
            <Text
              className="mt-3 text-center text-xs uppercase tracking-[1px]"
              style={{ color: palette.danger, fontFamily: 'Outfit_500Medium' }}
            >
              En danger
            </Text>
          ) : null}
        </View>
        <Text
          className="text-center text-sm"
          style={{ color: palette.success, fontFamily: 'Outfit_500Medium' }}
        >
          Potion de guérison
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

  const getPublicPlayerName = useCallback(
    (socketId: string): string => {
      if (socketId === player?.socketId) {
        return player.name;
      }

      return getPlayerNameFromSid(socketId);
    },
    [player, getPlayerNameFromSid]
  );

  const getSeerResultModalData = useCallback(() => {
    if (!seerVision) {
      return null;
    }

    return (
      <View className="items-center justify-center py-4">
        <Text
          className="text-lg"
          style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
        >
          {seerVision.playerName}
        </Text>
        <Text
          className="mt-2 text-2xl"
          style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
        >
          {ROLE_LABELS[seerVision.role]}
        </Text>
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
          <Text
            className="mt-2 text-center text-lg"
            style={{ color: palette.mist, fontFamily: 'Outfit_400Regular' }}
          >
            Vous aimez{' '}
            <Text style={{ color: palette.ink, fontFamily: 'Outfit_600SemiBold' }}>
              {loverPartnerName}
            </Text>
            {"\n"}Si l'un de vous meurt, l'autre meurt aussi.
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
      <ForestScreen solid>
        <View className="flex-1 items-center justify-center">
          <Text
            style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
          >
            Chargement…
          </Text>
        </View>
      </ForestScreen>
    );
  }

  if (!isGamePlayer(player)) {
    return null;
  }

  console.log(`player is: ${player.name}`);

  return (
    <ForestScreen solid>
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-6 w-full max-w-md items-center">
          <Text
            className="text-center text-xl"
            style={{ color: palette.snow, fontFamily: 'Outfit_600SemiBold' }}
          >
            {player.name}
          </Text>
          <Text
            className="mt-2 text-center text-xs uppercase tracking-[2px]"
            style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
          >
            {currentPhase.replace(/_/g, ' ')}
          </Text>
          {countdown && <PhaseCountdown countdown={countdown} />}
          {phaseTimedOut && (
            <Text
              className="mt-2 text-center text-sm"
              style={{ color: palette.warn, fontFamily: 'Outfit_500Medium' }}
            >
              Temps écoulé — la partie continue
            </Text>
          )}
          {actionError && (
            <View className="mt-3 w-full">
              <Banner message={actionError} tone="danger" />
            </View>
          )}
          {isWaitingForPlayers && (
            <Text
              className="mt-2 text-center text-sm"
              style={{ color: palette.warn, fontFamily: 'Outfit_400Regular' }}
            >
              En attente des autres joueurs…
            </Text>
          )}
          {isDiscussionActive && isAlive && (
            <View className="mt-4 w-56">
              <PrimaryButton
                accessibilityLabel="Passer au vote"
                label="Passer au vote"
                onPress={() => socket.emit('day:start-vote')}
                variant="ghost"
              />
            </View>
          )}
        </View>

        {(nightDeaths.length > 0 || dayVoteTie.length > 0) && (
          <View className="mb-6 w-full max-w-md">
            <Panel>
              {nightDeaths.length > 0 && (
                <View>
                  <Text
                    className="text-center text-xs uppercase tracking-[2px]"
                    style={{
                      color: palette.danger,
                      fontFamily: 'Outfit_500Medium',
                    }}
                  >
                    Victimes de la nuit
                  </Text>
                  {nightDeaths.map((death) => (
                    <Text
                      className="mt-2 text-center text-base"
                      key={`${death.playerId}-${death.cause}`}
                      style={{
                        color: palette.snow,
                        fontFamily: 'Outfit_400Regular',
                      }}
                    >
                      {death.playerName || getPublicPlayerName(death.playerId)}{' '}
                      ({death.cause})
                    </Text>
                  ))}
                </View>
              )}

              {dayVoteTie.length > 0 && (
                <View className={nightDeaths.length > 0 ? 'mt-4' : undefined}>
                  <Text
                    className="text-center text-xs uppercase tracking-[2px]"
                    style={{
                      color: palette.warn,
                      fontFamily: 'Outfit_500Medium',
                    }}
                  >
                    Égalité du vote
                  </Text>
                  <Text
                    className="mt-2 text-center text-base"
                    style={{
                      color: palette.snow,
                      fontFamily: 'Outfit_400Regular',
                    }}
                  >
                    {dayVoteTie.join(', ')}: personne ne meurt.
                  </Text>
                </View>
              )}
            </Panel>
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
              className="absolute inset-0 items-center justify-center rounded-3xl"
              style={{
                transform: [{ rotateY: animations.frontInterpolate }],
                opacity: animations.frontOpacity,
                backfaceVisibility: 'hidden',
                backgroundColor: palette.forest,
                borderWidth: 1.5,
                borderColor: palette.panelBorder,
              }}
            >
              <Text
                style={{
                  color: palette.moonDim,
                  fontFamily: 'Cinzel_700Bold',
                  fontSize: 72,
                }}
              >
                ?
              </Text>
              <Text
                className="mt-4 px-8 text-center text-base"
                style={{
                  color: palette.moonDim,
                  fontFamily: 'Outfit_400Regular',
                }}
              >
                Appuyez pour révéler votre rôle
              </Text>
            </Animated.View>

            <Animated.View
              className="absolute inset-0 items-center justify-center rounded-3xl p-6"
              style={{
                transform: [{ rotateY: animations.backInterpolate }],
                opacity: animations.backOpacity,
                backfaceVisibility: 'hidden',
                backgroundColor: palette.mist,
                borderWidth: 1.5,
                borderColor: palette.moon,
              }}
            >
              <View className="items-center">
                <Text
                  className="mb-4 text-center text-2xl"
                  style={{ color: palette.moon, fontFamily: 'Cinzel_700Bold' }}
                >
                  {ROLE_LABELS[player.role]}
                </Text>
                <View
                  className="h-px w-20"
                  style={{ backgroundColor: 'rgba(230, 231, 212, 0.45)' }}
                />
                <Text
                  className="mt-4 text-center text-base leading-6"
                  style={{
                    color: palette.snow,
                    fontFamily: 'Outfit_400Regular',
                  }}
                >
                  {getRoleDescription(player.role)}
                </Text>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </View>

        <View className="mt-8">
          <Text
            className="text-center text-sm"
            style={{ color: palette.bark, fontFamily: 'Outfit_400Regular' }}
          >
            {isRevealed
              ? 'La carte se cachera automatiquement dans 5 secondes'
              : 'Touchez la carte pour découvrir votre rôle'}
          </Text>
        </View>
      </View>
    </ForestScreen>
  );
}
