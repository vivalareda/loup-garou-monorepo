import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

export const useCardFlip = () => {
  const [isRevealed, setIsRevealed] = useState(false);
  const flipAnimation = useRef(new Animated.Value(0)).current;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const flipCard = useCallback(() => {
    if (isRevealed) {
      return;
    }

    setIsRevealed(true);

    Animated.spring(flipAnimation, {
      toValue: 1,
      tension: 80,
      friction: 8,
      useNativeDriver: true,
    }).start();

    timeoutRef.current = setTimeout(() => {
      Animated.spring(flipAnimation, {
        toValue: 0,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start(() => {
        setIsRevealed(false);
      });
    }, 2000);
  }, [isRevealed, flipAnimation]);

  const frontInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const backInterpolate = flipAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });

  const frontOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0, 0],
  });

  const backOpacity = flipAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isRevealed,
    flipCard,
    animations: {
      frontInterpolate,
      backInterpolate,
      frontOpacity,
      backOpacity,
    },
  };
};
