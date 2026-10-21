import {
  Cinzel_700Bold,
  useFonts as useCinzel,
} from '@expo-google-fonts/cinzel';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  useFonts as useOutfit,
} from '@expo-google-fonts/outfit';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// oxlint-disable-next-line import/no-unassigned-import -- NativeWind's stylesheet is loaded for its side effect: it registers the Tailwind classes
import '../global.css';
import React, { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { GlobalModal } from '@/components/global-modal';
import { useSessionRecovery } from '@/hooks/use-session-recovery';
import { setAndroidNavigationBar } from '@/lib/android-navigation-bar';
import { NAV_THEME } from '@/lib/constants';
import { palette } from '@/lib/theme';
import { useColorScheme } from '@/lib/use-color-scheme';
import { rooms } from '@/utils/rooms';

const LIGHT_THEME = {
  ...DefaultTheme,
  colors: NAV_THEME.light,
};

const DARK_THEME = {
  ...DarkTheme,
  colors: {
    ...NAV_THEME.dark,
    background: palette.night,
    card: palette.forest,
    primary: palette.moon,
    text: palette.snow,
    border: palette.mist,
  },
};

export default function RootLayout() {
  const hasMounted = useRef(false);
  const { colorScheme, isDarkColorScheme } = useColorScheme();
  const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);
  const [cinzelLoaded] = useCinzel({ Cinzel_700Bold });
  const [outfitLoaded] = useOutfit({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
  });
  const fontsReady = cinzelLoaded && outfitLoaded;

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
      document.documentElement.style.backgroundColor = palette.night;
    }

    setAndroidNavigationBar(colorScheme);
    setIsColorSchemeLoaded(true);
    hasMounted.current = true;
  }, []);

  if (!(isColorSchemeLoaded && fontsReady)) {
    return <View style={{ flex: 1, backgroundColor: palette.night }} />;
  }

  return (
    <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
      <StatusBar style="light" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.night }}>
        <Stack screenOptions={{ headerShown: false }}>
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
