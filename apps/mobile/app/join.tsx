import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Banner } from '@/components/ui/banner';
import { FadeIn } from '@/components/ui/fade-in';
import { Field } from '@/components/ui/field';
import { ForestScreen } from '@/components/ui/forest-screen';
import { PrimaryButton } from '@/components/ui/primary-button';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { registerJoinListeners, submitJoin } from '@/hooks/use-join-game';
import { usePlayerStore } from '@/hooks/use-player-store';
import { palette } from '@/lib/theme';
import { rooms } from '@/utils/rooms';
import { sessionTokens } from '@/utils/session';
import { socket } from '@/utils/sockets';

/**
 * The name form of the room the app is in (entered on the room screen).
 * The room's code is shown only in the waiting room, once joined: a room's
 * creator cannot share it before being in, so they are always its first
 * player and therefore its host.
 */
export default function JoinRoom() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const { setPlayer } = usePlayerStore();

  const { recoveryFailed, setRecoveryFailed, status, roomCode } =
    useConnectionStore();

  const isDev = process.env.NODE_ENV === 'development';

  useEffect(
    () =>
      registerJoinListeners(socket, {
        // Synchronous on purpose: awaiting the token write first would
        // leave a window where "Changer de partie" moves to another room
        // and this room's player lands on top of it
        onJoined: (playerData) => {
          console.log('server response', playerData);
          setIsJoining(false);
          setPlayer(playerData);
          router.push('/waiting-room');

          if (playerData.sessionToken) {
            sessionTokens.save(playerData.sessionToken).catch((error) => {
              console.error('Failed to save session token', error);
            });
          }
        },
        onRejected: (message) => {
          setIsJoining(false);
          setJoinError(message);
        },
      }),
    [router, setPlayer]
  );

  // A join in flight when the connection drops gets no answer: let the
  // player tap again once reconnected
  useEffect(
    () =>
      useConnectionStore.subscribe((state) => {
        if (state.status === 'reconnecting') {
          setIsJoining(false);
        }
      }),
    []
  );

  const handleJoinGame = () => {
    if (isJoining) {
      return;
    }

    setRecoveryFailed(false);
    setJoinError(null);

    // While the socket is reconnecting the join would be dropped (emits
    // are not replayed after an outage) and the button would spin forever
    if (status === 'reconnecting') {
      setJoinError('Connexion au serveur perdue — réessayez dans un instant.');

      return;
    }

    if (!submitJoin(socket, name)) {
      setJoinError('Entrez un nom valide.');

      return;
    }

    setIsJoining(true);
  };

  const handleChangeRoom = () => {
    setRecoveryFailed(false);
    rooms.leave();
    router.replace('/');
  };

  if (!roomCode) {
    return <Redirect href="/" />;
  }

  return (
    <ForestScreen dismissKeyboard>
      <View className="flex-1 justify-end px-8 pb-10">
        <FadeIn delayMs={80}>
          <View className="w-full max-w-sm self-center">
            {recoveryFailed && (
              <Banner
                message="Session précédente expirée — rejoignez la partie."
                tone="warn"
              />
            )}
            {joinError && <Banner message={joinError} tone="danger" />}

            <Field
              autoCapitalize="words"
              label="Votre nom"
              onChangeText={setName}
              onSubmitEditing={handleJoinGame}
              placeholder="Alex"
              value={name}
            />

            <View className="mt-5">
              <PrimaryButton
                disabled={isJoining}
                label={isJoining ? 'Connexion…' : 'Entrer dans la partie'}
                onPress={handleJoinGame}
              />
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              className="mt-5 items-center py-2"
              onPress={handleChangeRoom}
            >
              <Text
                style={{
                  color: palette.moonDim,
                  fontFamily: 'Outfit_500Medium',
                  fontSize: 15,
                  textDecorationLine: 'underline',
                }}
              >
                Changer de partie
              </Text>
            </TouchableOpacity>

            {isDev && (
              <Link asChild href="/modal-test">
                <TouchableOpacity className="mt-6 items-center py-2">
                  <Text
                    style={{
                      color: palette.bark,
                      fontFamily: 'Outfit_400Regular',
                      fontSize: 13,
                    }}
                  >
                    Test modal
                  </Text>
                </TouchableOpacity>
              </Link>
            )}
          </View>
        </FadeIn>
      </View>
    </ForestScreen>
  );
}
