import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// oxlint-disable-next-line import/no-unassigned-import -- NativeWind's stylesheet is loaded for its side effect: it registers the Tailwind classes
import '../global.css';
import React, { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { GlobalModal } from '@/components/global-modal';
import { useSessionRecovery } from '@/hooks/use-session-recovery';
import { setAndroidNavigationBar } from '@/lib/android-navigation-bar';
import { NAV_THEME } from '@/lib/constants';
import { palette } from '@/lib/palette';
import { useColorScheme } from '@/lib/use-color-scheme';
import { rooms } from '@/utils/rooms';

const DARK_THEME = {
  ...DarkTheme,
  colors: NAV_THEME.dark,
};

export default function RootLayout() {
  const hasMounted = useRef(false);
  const { colorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

  // Reconnect/session-recovery listeners live at the root so they survive
  // every navigation, including back to the join screen
  useSessionRecovery();

  // A relaunch goes back into the room the player had joined, if any
  useEffect(() => {
    rooms.restore().catch((error) => {
      console.error('Failed to restore the room', error);
    });
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (hasMounted.current) {
      return;
    }

    if (Platform.OS === 'web') {
      document.documentElement.classList.add('bg-background');
    }

    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!isColorSchemeLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={DARK_THEME}>
      {/* Every screen is a night scene, whatever the system theme */}
      {/* oxlint-disable-next-line react/style-prop-object -- expo-status-bar's style is a color scheme name, not a style object */}
      <StatusBar style="light" />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.ink[950] },
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="join" />
          <Stack.Screen name="(game)" />
          <Stack.Screen name="modal-test" />
        </Stack>
        <GlobalModal />
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}

const useIsomorphicLayoutEffect =
  Platform.OS === 'web' && typeof window === 'undefined'
    ? React.useEffect
    : React.useLayoutEffect;
