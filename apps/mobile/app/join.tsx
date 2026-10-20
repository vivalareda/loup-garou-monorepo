import { Link, Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Button,
  ImageBackground,
  Keyboard,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { leaveRoom } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { registerJoinListeners, submitJoin } from '@/hooks/use-join-game';
import { usePlayerStore } from '@/hooks/use-player-store';
import { saveSessionToken } from '@/utils/session';

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
      registerJoinListeners({
        // Synchronous on purpose: awaiting the token write first would
        // leave a window where "Changer de partie" moves to another room
        // and this room's player lands on top of it
        onJoined: (playerData) => {
          console.log('server response', playerData);
          setIsJoining(false);
          setPlayer(playerData);
          router.push('/waiting-room');
          if (playerData.sessionToken) {
            saveSessionToken(playerData.sessionToken).catch((error) => {
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
  useEffect(() => {
    if (status === 'reconnecting') {
      setIsJoining(false);
    }
  }, [status]);

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

    if (!submitJoin(name)) {
      setJoinError('Entrez un nom valide.');
      return;
    }
    setIsJoining(true);
  };

  const handleChangeRoom = () => {
    setRecoveryFailed(false);
    leaveRoom();
    router.replace('/');
  };

  if (!roomCode) {
    return <Redirect href="/" />;
  }

  return (
    <ImageBackground
      className="flex-1"
      resizeMethod="resize"
      source={require('@/assets/join-screen-background.png')}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView className="flex-1 items-center justify-center pb-24">
          <View className="items-center justify-between gap-20">
            <View className="mt-32 pb-12">
              <Text className="text-7xl font-bold text-white"> </Text>
            </View>
            <View className="mt-56 items-center self-stretch">
              {recoveryFailed && (
                <View className="mb-4 rounded-xl bg-amber-500/90 px-4 py-3">
                  <Text className="text-center font-semibold text-slate-900">
                    Session précédente expirée — rejoignez la partie.
                  </Text>
                </View>
              )}
              {joinError && (
                <View className="mb-4 rounded-xl bg-red-500/90 px-4 py-3">
                  <Text className="text-center font-semibold text-white">
                    {joinError}
                  </Text>
                </View>
              )}
              <Text className="text-center text-4xl font-bold text-white">
                Entrez votre nom
              </Text>
              <TextInput
                className="mt-4 h-16 w-full rounded-lg border-2 border-gray-100/50 bg-slate-600 pb-2 text-center text-2xl font-bold text-white"
                onChangeText={setName}
                value={name}
              />
              <View className="mt-8 w-52 items-center justify-center">
                <TouchableOpacity
                  className={`rounded-lg px-8 py-4 ${
                    isJoining ? 'bg-slate-400/40' : 'bg-slate-200/50'
                  }`}
                  disabled={isJoining}
                  onPress={handleJoinGame}
                >
                  <Text>{isJoining ? 'Connexion…' : 'Join game'}</Text>
                </TouchableOpacity>
                <TouchableOpacity className="mt-4" onPress={handleChangeRoom}>
                  <Text className="text-white underline">
                    Changer de partie
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View>
              {isDev && (
                <Link asChild href="/modal-test">
                  <Button title="🧪 Test Modal" />
                </Link>
              )}
            </View>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </ImageBackground>
  );
}
