import { Text, TouchableOpacity, View } from 'react-native';
import { palette } from '@/lib/theme';

type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  accessibilityLabel?: string;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
}: PrimaryButtonProps) {
  const backgroundColor =
    variant === 'primary'
      ? disabled
        ? 'rgba(230, 231, 212, 0.28)'
        : palette.moon
      : variant === 'danger'
        ? palette.danger
        : 'transparent';

  const textColor =
    variant === 'primary'
      ? palette.ink
      : variant === 'danger'
        ? palette.snow
        : palette.moon;

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: '100%',
        borderRadius: 14,
        backgroundColor,
        borderWidth: variant === 'ghost' ? 1.5 : 0,
        borderColor:
          variant === 'ghost' ? 'rgba(230, 231, 212, 0.35)' : 'transparent',
        paddingVertical: 16,
        paddingHorizontal: 24,
        opacity: disabled && variant !== 'primary' ? 0.45 : 1,
      }}
    >
      <Text
        className="text-center text-lg"
        style={{
          color: textColor,
          fontFamily: 'Outfit_600SemiBold',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type IconButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

/** Square ± control used in the lobby host strip. */
export function StepperButton({ label, onPress, disabled }: IconButtonProps) {
  return (
    <TouchableOpacity
      accessibilityLabel={label === '−' ? 'Diminuer' : 'Augmenter'}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 52,
        height: 52,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? 'rgba(230, 231, 212, 0.08)'
          : 'rgba(230, 231, 212, 0.18)',
        borderWidth: 1,
        borderColor: disabled
          ? 'rgba(230, 231, 212, 0.08)'
          : 'rgba(230, 231, 212, 0.28)',
      }}
    >
      <Text
        style={{
          color: disabled ? palette.bark : palette.moon,
          fontSize: 28,
          fontFamily: 'Outfit_600SemiBold',
          lineHeight: 32,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        width: '100%',
        borderRadius: 18,
        backgroundColor: palette.panel,
        borderWidth: 1,
        borderColor: palette.panelBorder,
        padding: 20,
      }}
    >
      {children}
    </View>
  );
}
