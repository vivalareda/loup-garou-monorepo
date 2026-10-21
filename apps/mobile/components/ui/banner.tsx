import { Text, View } from 'react-native';
import { palette } from '@/lib/theme';

type BannerTone = 'danger' | 'warn' | 'info';

const TONES: Record<
  BannerTone,
  { bg: string; border: string; text: string }
> = {
  danger: {
    bg: palette.dangerSoft,
    border: 'rgba(196, 92, 74, 0.45)',
    text: palette.snow,
  },
  warn: {
    bg: palette.warnSoft,
    border: 'rgba(212, 162, 90, 0.45)',
    text: palette.moon,
  },
  info: {
    bg: 'rgba(230, 231, 212, 0.12)',
    border: 'rgba(230, 231, 212, 0.28)',
    text: palette.moon,
  },
};

export function Banner({
  message,
  tone = 'info',
}: {
  message: string;
  tone?: BannerTone;
}) {
  const colors = TONES[tone];

  return (
    <View
      style={{
        width: '100%',
        borderRadius: 14,
        backgroundColor: colors.bg,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 16,
      }}
    >
      <Text
        className="text-center text-base"
        style={{ color: colors.text, fontFamily: 'Outfit_500Medium' }}
      >
        {message}
      </Text>
    </View>
  );
}
