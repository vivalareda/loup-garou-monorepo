import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
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
import { usePlayerStore } from '@/hooks/usePlayerStore';
import { socket } from '@/utils/sockets';

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState('');
  const { setPlayer } = usePlayerStore();
  const isDev = process.env.NODE_ENV === 'development';

  const handleJoinGame = () => {
    socket.emit('player:join', name);
    socket.on('lobby:player-data', (playerData) => {
      console.log('server response', playerData);
      setPlayer(playerData);
      router.push('/waiting-room');
    });
  };

  return (
    <ImageBackground
      className="flex-1"
      source={require('@/assets/join-screen-background.png')}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView className="flex-1 items-center justify-center pb-24">
          <View className="items-center justify-between gap-20">
            <View className="mt-32 pb-12">
              <Text className="text-7xl font-bold text-white">Loup-Garou</Text>
            </View>
            <View className="mt-56 items-center self-stretch">
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
                  className="rounded-lg bg-slate-200/50 px-8 py-4"
                  onPress={handleJoinGame}
                >
                  <Text>Join game</Text>
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
