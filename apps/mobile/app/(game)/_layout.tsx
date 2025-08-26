import { Stack } from 'expo-router';

export default function GameLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="waiting-room" />
      <Stack.Screen name="death-screen" />
      <Stack.Screen name="winner-screen" />
      <Stack.Screen name="loser-screen" />
      <Stack.Screen name="game-interface" />
    </Stack>
  );
}
