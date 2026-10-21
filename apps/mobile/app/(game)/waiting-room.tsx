import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '@repo/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Banner } from '@/components/ui/banner';
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
          justifyContent: 'flex-end',
          paddingHorizontal: 24,
          paddingTop: 48,
          paddingBottom: 28,
        }}
      >
        <View className="w-full max-w-md gap-5 self-center">
          {roomCode && (
            <Panel>
              <Text
                style={{
                  textAlign: 'center',
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: 'uppercase',
                  color: palette.moonDim,
                  fontFamily: 'Outfit_500Medium',
                }}
              >
                Code de la partie
              </Text>
              <Text
                selectable
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontSize: 36,
                  letterSpacing: 6,
                  color: palette.moon,
                  fontFamily: 'Cinzel_700Bold',
                }}
              >
                {formatRoomCode(roomCode)}
              </Text>
              <Text
                style={{
                  marginTop: 10,
                  textAlign: 'center',
                  fontSize: 14,
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
                  fontSize: 40,
                }}
              >
                {joinedCount}
                <Text
                  style={{
                    color: palette.moonDim,
                    fontFamily: 'Outfit_400Regular',
                    fontSize: 26,
                  }}
                >
                  /{requiredPlayerCount}
                </Text>
              </Text>
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
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
              style={{
                marginBottom: 12,
                textAlign: 'center',
                fontSize: 11,
                letterSpacing: 2,
                textTransform: 'uppercase',
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
                style={{
                  marginTop: 8,
                  textAlign: 'center',
                  fontSize: 14,
                  color: palette.moonDim,
                  fontFamily: 'Outfit_400Regular',
                }}
              >
                Attendez que d'autres joueurs vous rejoignent
              </Text>
            )}
          </Panel>
        </View>
      </ScrollView>
    </ForestScreen>
  );
}
