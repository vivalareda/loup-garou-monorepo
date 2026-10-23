import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Backdrop, Banner, Button, Field } from '@/components/ui';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { registerJoinListeners, submitJoin } from '@/hooks/use-join-game';
import { usePlayerStore } from '@/hooks/use-player-store';
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

  // Session restore on app start and after reconnects is handled globally
  // by useSessionRecovery in the root layout.

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
    <Backdrop variant="artwork">
      {/* Tapping outside the field closes the keyboard; not an a11y target */}
      <Pressable
        accessible={false}
        className="flex-1"
        onPress={Keyboard.dismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end px-6 pb-6"
        >
          <View className="gap-3">
            {recoveryFailed && (
              <Banner tone="warning">
                Session précédente expirée — rejoignez la partie.
              </Banner>
            )}
            {joinError && <Banner tone="error">{joinError}</Banner>}

            <Text className="mb-1 text-center text-2xl font-bold text-moon-100">
              Comment vous appelle-t-on ?
            </Text>
            <Field
              accessibilityLabel="Votre nom"
              autoCapitalize="words"
              autoComplete="off"
              // A name is not a dictionary word: autocorrect turns "Reda"
              // into "Read" on submit
              autoCorrect={false}
              maxLength={20}
              onChangeText={setName}
              onSubmitEditing={handleJoinGame}
              placeholder="Votre nom"
              returnKeyType="join"
              spellCheck={false}
              value={name}
            />
            <Button
              disabled={name.trim() === ''}
              label="Entrer dans le village"
              loading={isJoining}
              onPress={handleJoinGame}
            />
            <Button
              label="Changer de partie"
              onPress={handleChangeRoom}
              size="sm"
              variant="ghost"
            />

            {isDev && (
              <Link asChild href="/modal-test">
                <Button
                  label="🧪 Tester les modales"
                  onPress={() => undefined}
                  size="sm"
                  variant="ghost"
                />
              </Link>
            )}
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </Backdrop>
  );
}
