import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ImageBackground,
  Keyboard,
  SafeAreaView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import {
  createAndEnterRoom,
  joinRoomByCode,
  type RoomEntry,
} from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';

/**
 * The first screen: create a private room, or join one with the code its
 * creator shared. Either way the app connects to that room and moves on
 * to its name form (join.tsx).
 */
export default function RoomScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { recoveryFailed, setRecoveryFailed } = useConnectionStore();

  const enter = async (attempt: () => Promise<RoomEntry>) => {
    if (busy) {
      return;
    }
    Keyboard.dismiss();
    setRecoveryFailed(false);
    setError(null);
    setBusy(true);
    const entry = await attempt();
    setBusy(false);
    if (entry.ok) {
      router.push('/join');
    } else {
      setError(entry.error);
    }
  };

  return (
    <ImageBackground
      className="flex-1"
      resizeMethod="resize"
      source={require('@/assets/join-screen-background.png')}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView className="flex-1 items-center justify-center pb-24">
          <View className="mt-80 w-72 items-center">
            {recoveryFailed && (
              <View className="mb-4 rounded-xl bg-amber-500/90 px-4 py-3">
                <Text className="text-center font-semibold text-slate-900">
                  Cette partie n'existe plus — créez-en une autre.
                </Text>
              </View>
            )}
            {error && (
              <View className="mb-4 rounded-xl bg-red-500/90 px-4 py-3">
                <Text className="text-center font-semibold text-white">
                  {error}
                </Text>
              </View>
            )}
            <TouchableOpacity
              className={`w-full rounded-lg px-8 py-4 ${
                busy ? 'bg-slate-400/40' : 'bg-slate-200/50'
              }`}
              disabled={busy}
              onPress={() => enter(createAndEnterRoom)}
            >
              <Text className="text-center text-lg font-bold">
                Créer une partie
              </Text>
            </TouchableOpacity>

            <Text className="mt-10 text-center text-2xl font-bold text-white">
              Code de la partie
            </Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              className="mt-4 h-16 w-full rounded-lg border-2 border-gray-100/50 bg-slate-600 pb-2 text-center text-2xl font-bold text-white"
              onChangeText={setCode}
              onSubmitEditing={() => enter(() => joinRoomByCode(code))}
              placeholder="ABCD-2345"
              placeholderTextColor="#94a3b8"
              value={code}
            />
            <TouchableOpacity
              className={`mt-4 w-full rounded-lg px-8 py-4 ${
                busy ? 'bg-slate-400/40' : 'bg-slate-200/50'
              }`}
              disabled={busy}
              onPress={() => enter(() => joinRoomByCode(code))}
            >
              <Text className="text-center text-lg font-bold">
                {busy ? 'Connexion…' : 'Rejoindre'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </ImageBackground>
  );
}
