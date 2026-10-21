import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '@repo/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Banner } from '@/components/ui/banner';
import { FadeIn } from '@/components/ui/fade-in';
import { ForestScreen } from '@/components/ui/forest-screen';
import { Panel, PrimaryButton, StepperButton } from '@/components/ui/primary-button';
import { formatRoomCode } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { palette } from '@/lib/theme';
import { socket } from '@/utils/sockets';

/** Asks the server to start the game at `count` players (it starts by itself once that many joined). */
function setCount(count: number) {
  socket.emit('lobby:set-player-count', count);
}

/**
 * The host's lobby controls: how many players the game starts at, and
 * starting right away with the players already in.
 */
function HostControls({
  joinedCount,
  requiredPlayerCount,
}: {
  joinedCount: number;
  requiredPlayerCount: number;
}) {
  const canLower =
    requiredPlayerCount > Math.max(MIN_PLAYER_COUNT, joinedCount);

  const canRaise = requiredPlayerCount < MAX_PLAYER_COUNT;

  const canStartNow =
    joinedCount >= MIN_PLAYER_COUNT && joinedCount < requiredPlayerCount;

  return (
    <View className="items-center gap-5">
      <View className="flex-row items-center gap-5">
        <StepperButton
          disabled={!canLower}
          label="−"
          onPress={() => setCount(requiredPlayerCount - 1)}
        />
        <View className="min-w-[110px] items-center">
          <Text
            style={{
              color: palette.moon,
              fontFamily: 'Cinzel_700Bold',
              fontSize: 36,
            }}
          >
            {requiredPlayerCount}
          </Text>
          <Text
            style={{
              color: palette.moonDim,
              fontFamily: 'Outfit_400Regular',
              fontSize: 13,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            joueurs
          </Text>
        </View>
        <StepperButton
          disabled={!canRaise}
          label="+"
          onPress={() => setCount(requiredPlayerCount + 1)}
        />
      </View>
      {canStartNow && (
        <PrimaryButton
          label={`Lancer à ${joinedCount} joueurs`}
          onPress={() => setCount(joinedCount)}
          variant="ghost"
        />
      )}
    </View>
  );
}

function PlayerChip({ name, isYou }: { name: string; isYou?: boolean }) {
  return (
    <View
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isYou
          ? 'rgba(230, 231, 212, 0.45)'
          : 'rgba(230, 231, 212, 0.16)',
        backgroundColor: isYou
          ? 'rgba(230, 231, 212, 0.14)'
          : 'rgba(11, 18, 22, 0.35)',
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: palette.snow,
          fontFamily: 'Outfit_500Medium',
          fontSize: 16,
          textAlign: 'center',
        }}
      >
        {name}
        {isYou ? ' (vous)' : ''}
      </Text>
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
  const others = playersList.filter((p) => p.name !== player.name);

  return (
    <ForestScreen dimmed>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
      >
        <FadeIn>
          <View className="w-full max-w-md gap-6 self-center">
            {roomCode && (
              <Panel>
                <Text
                  className="text-center text-xs uppercase tracking-[3px]"
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_500Medium',
                  }}
                >
                  Code de la partie
                </Text>
                <Text
                  className="mt-2 text-center text-4xl tracking-[6px]"
                  style={{
                    color: palette.moon,
                    fontFamily: 'Cinzel_700Bold',
                  }}
                  selectable
                >
                  {formatRoomCode(roomCode)}
                </Text>
                <Text
                  className="mt-3 text-center text-sm"
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_400Regular',
                  }}
                >
                  Partagez ce code avec vos amis
                </Text>
              </Panel>
            )}

            {requiredPlayerCount !== null && (
              <View className="items-center">
                <Text
                  style={{
                    color: palette.snow,
                    fontFamily: 'Cinzel_700Bold',
                    fontSize: 42,
                  }}
                >
                  {joinedCount}
                  <Text
                    style={{
                      color: palette.moonDim,
                      fontFamily: 'Outfit_400Regular',
                      fontSize: 28,
                    }}
                  >
                    /{requiredPlayerCount}
                  </Text>
                </Text>
                <Text
                  className="mt-1 text-sm uppercase tracking-[2px]"
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_500Medium',
                  }}
                >
                  joueurs connectés
                </Text>
              </View>
            )}

            {isHost && requiredPlayerCount !== null && (
              <HostControls
                joinedCount={joinedCount}
                requiredPlayerCount={requiredPlayerCount}
              />
            )}

            {actionError && <Banner message={actionError} tone="danger" />}

            <Panel>
              <Text
                className="mb-3 text-center text-xs uppercase tracking-[2px]"
                style={{
                  color: palette.moonDim,
                  fontFamily: 'Outfit_500Medium',
                }}
              >
                Dans la salle
              </Text>
              <PlayerChip isYou name={player.name} />
              {others.map((p) => (
                <PlayerChip key={p.socketId} name={p.name} />
              ))}
              {others.length === 0 && (
                <Text
                  className="mt-2 text-center text-sm"
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_400Regular',
                  }}
                >
                  Attendez que d'autres joueurs vous rejoignent
                </Text>
              )}
            </Panel>
          </View>
        </FadeIn>
      </ScrollView>
    </ForestScreen>
  );
}
