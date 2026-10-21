import { type ReactNode, useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

type FadeInProps = {
  children: ReactNode;
  delayMs?: number;
  fromY?: number;
};

/** Short entrance motion for hierarchy — used on entry and lobby shells. */
export function FadeIn({ children, delayMs = 0, fromY = 12 }: FadeInProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(fromY);

  useEffect(() => {
    opacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
    translateY.value = withDelay(
      delayMs,
      withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) })
    );
  }, [delayMs, opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}
