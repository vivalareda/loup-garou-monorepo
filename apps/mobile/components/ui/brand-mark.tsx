import { Text, View } from 'react-native';
import { palette } from '@/lib/theme';

type BrandMarkProps = {
  /** Compact mark for screens that already show the key-art title */
  compact?: boolean;
  subtitle?: string;
};

/**
 * Wordmark for screens without the branded key art baked in.
 * Cinzel matches the theatrical LOUP GAROU tone of the splash art.
 */
export function BrandMark({ compact = false, subtitle }: BrandMarkProps) {
  return (
    <View className="items-center">
      <Text
        className={compact ? 'text-3xl tracking-widest' : 'text-5xl tracking-[4px]'}
        style={{
          color: palette.moon,
          fontFamily: 'Cinzel_700Bold',
          textShadowColor: 'rgba(0,0,0,0.55)',
          textShadowOffset: { width: 0, height: 2 },
          textShadowRadius: 8,
        }}
      >
        LOUP GAROU
      </Text>
      {subtitle ? (
        <Text
          className="mt-2 text-center text-base"
          style={{ color: palette.moonDim, fontFamily: 'Outfit_400Regular' }}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
