import type { ReactNode } from 'react';
import {
  ImageBackground,
  Keyboard,
  type StyleProp,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '@/lib/theme';

const FOREST_ART = require('@/assets/join-screen-background-2.png');

type ForestScreenProps = {
  children: ReactNode;
  /** Dim the art so foreground UI stays readable */
  dimmed?: boolean;
  dismissKeyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** Solid night fallback when art should not dominate (in-game screens) */
  solid?: boolean;
};

/**
 * Shared night-forest shell. Entry screens keep the branded key art;
 * in-game screens use a solid night panel with the same palette.
 */
export function ForestScreen({
  children,
  dimmed = false,
  dismissKeyboard = false,
  contentStyle,
  solid = false,
}: ForestScreenProps) {
  const body = (
    <SafeAreaView className="flex-1" style={contentStyle}>
      {children}
    </SafeAreaView>
  );

  if (solid) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.night }}>{body}</View>
    );
  }

  const framed = dismissKeyboard ? (
    <TouchableWithoutFeedback accessible={false} onPress={Keyboard.dismiss}>
      <View className="flex-1">{body}</View>
    </TouchableWithoutFeedback>
  ) : (
    body
  );

  return (
    <ImageBackground
      className="flex-1"
      resizeMethod="resize"
      source={FOREST_ART}
      style={{ backgroundColor: palette.night }}
    >
      {dimmed ? (
        <View className="flex-1" style={{ backgroundColor: palette.overlay }}>
          {framed}
        </View>
      ) : (
        framed
      )}
    </ImageBackground>
  );
}
