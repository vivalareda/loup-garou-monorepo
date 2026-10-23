import { MAX_PLAYER_COUNT, MIN_PLAYER_COUNT } from '@repo/types';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, Share, Text, View } from 'react-native';
import { Avatar, Backdrop, Banner, Button, Eyebrow } from '@/components/ui';
import { formatRoomCode } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { socket } from '@/utils/sockets';

/** Asks the server to start the game at `count` players (host only). */
function setCount(count: number) {
  socket.emit('lobby:set-player-count', count);
}

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
  const canLower =
    requiredPlayerCount > Math.max(MIN_PLAYER_COUNT, joinedCount);

  const canRaise = requiredPlayerCount < MAX_PLAYER_COUNT;

  const canStartNow =
    joinedCount >= MIN_PLAYER_COUNT && joinedCount < requiredPlayerCount;

  return (
    <View className="gap-4 rounded-3xl border border-ink-700 bg-ink-900/80 p-5">
      <View className="flex-row items-center justify-between">
        <View>
          <Eyebrow>Vous êtes l'hôte</Eyebrow>
          <Text className="mt-1 text-base text-ink-200">Nombre de joueurs</Text>
        </View>
        <View className="flex-row items-center gap-3">
          <Button
            className="w-12"
            disabled={!canLower}
            label="−"
            onPress={() => setCount(requiredPlayerCount - 1)}
            size="sm"
            variant="secondary"
          />
          <Text className="w-8 text-center text-2xl font-bold text-moon-100">
            {requiredPlayerCount}
          </Text>
          <Button
            className="w-12"
            disabled={!canRaise}
            label="+"
            onPress={() => setCount(requiredPlayerCount + 1)}
            size="sm"
            variant="secondary"
          />
        </View>
      </View>
      {canStartNow && (
        <Button
          label={`Lancer maintenant à ${joinedCount}`}
          onPress={() => setCount(joinedCount)}
        />
      )}
    </View>
  );
}

/** One seat of the lobby: a joined player, or an empty chair. */
function Seat({
  name,
  isSelf,
  isHost,
}: {
  name: string | null;
  isSelf?: boolean;
  isHost?: boolean;
}) {
  if (name === null) {
    return (
      <View className="flex-row items-center gap-3 rounded-2xl border border-dashed border-ink-600 px-3 py-2.5">
        <View className="h-9 w-9 rounded-full border border-dashed border-ink-500" />
        <Text className="text-ink-400">En attente d'un joueur…</Text>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-ink-800/80 px-3 py-2.5">
      <Avatar name={name} size={36} />
      <Text className="flex-1 text-base font-semibold text-moon-100">
        {name}
      </Text>
      {isHost && <Text className="text-xs text-moon-500">👑 Hôte</Text>}
      {isSelf && (
        <View className="rounded-full bg-moon/15 px-2 py-0.5">
          <Text className="text-xs font-semibold text-moon">Vous</Text>
        </View>
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
  const displayCode = roomCode ? formatRoomCode(roomCode) : null;

  const emptySeats = Math.max(0, (requiredPlayerCount ?? 0) - joinedCount);

  const shareCode = () => {
    if (displayCode) {
      Share.share({
        message: `Rejoins ma partie de Loup-Garou avec le code ${displayCode}`,
      }).catch((error) => console.error('Failed to share the code', error));
    }
  };

  return (
    <Backdrop>
      <ScrollView contentContainerClassName="gap-6 px-6 pb-10 pt-6">
        <View className="items-center">
          <Eyebrow>Salle d'attente</Eyebrow>
          <Text className="mt-2 text-center text-3xl font-bold text-moon-100">
            Le village se rassemble
          </Text>
        </View>

        {displayCode && (
          <View className="items-center gap-3 rounded-3xl border border-moon/25 bg-ink-900/80 p-5">
            <Eyebrow>Code de la partie</Eyebrow>
            <Text
              className="text-4xl font-bold tracking-[6px] text-moon"
              selectable
            >
              {displayCode}
            </Text>
            <Button
              label="Partager le code"
              onPress={shareCode}
              size="sm"
              variant="secondary"
            />
          </View>
        )}

        {isHost && requiredPlayerCount !== null && (
          <HostControls
            joinedCount={joinedCount}
            requiredPlayerCount={requiredPlayerCount}
          />
        )}

        {actionError && <Banner tone="error">{actionError}</Banner>}

        <View className="gap-2">
          <View className="mb-1 flex-row items-baseline justify-between">
            <Eyebrow>Joueurs</Eyebrow>
            {requiredPlayerCount !== null && (
              <Text className="text-sm font-semibold text-ink-300">
                {joinedCount} / {requiredPlayerCount}
              </Text>
            )}
          </View>
          <Seat
            isHost={hostSocketId === player.socketId}
            isSelf
            name={player.name}
          />
          {playersList.map((other) => (
            <Seat
              isHost={hostSocketId === other.socketId}
              key={other.socketId}
              name={other.name}
            />
          ))}
          {Array.from({ length: emptySeats }, (_, seat) => (
            <Seat key={`empty-${seat}`} name={null} />
          ))}
        </View>

        <Text className="text-center text-sm text-ink-400">
          La partie commence d'elle-même quand tout le monde est là.
        </Text>
      </ScrollView>
    </Backdrop>
  );
}
