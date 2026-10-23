import { clsx } from 'clsx';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { palette } from '@/lib/palette';

/**
 * The app's shared building blocks. Every screen is a Backdrop holding
 * Buttons, Fields, Banners and Avatars, so the night-village look lives
 * here instead of being re-typed as class lists on each screen.
 */

const ARTWORK = require('@/assets/join-screen-background-3.png');

// The artwork's width / height (1024 x 1536)
const ARTWORK_RATIO = 2 / 3;

type BackdropProps = {
  children: ReactNode;
  /** `artwork` shows the title art behind the content (entry screens). */
  variant?: 'artwork' | 'night' | 'victory' | 'defeat';
};

// Top-to-bottom sky gradients for the plain variants
const SKIES: Record<
  Exclude<BackdropProps['variant'], 'artwork' | undefined>,
  [string, string]
> = {
  night: [palette.ink[800], palette.ink[950]],
  victory: ['#1E3F33', palette.ink[950]],
  defeat: [palette.blood[900], palette.ink[950]],
};

/** Full-screen background with safe-area padding for its content. */
export function Backdrop({ children, variant = 'night' }: BackdropProps) {
  if (variant === 'artwork') {
    return (
      <View className="flex-1 bg-ink-950">
        {/* Full-width at the top so the title is never cropped; the
            gradient fades its bottom edge into the solid ink below */}
        <ImageBackground
          className="absolute left-0 right-0 top-0"
          resizeMode="cover"
          source={ARTWORK}
          style={{ width: '100%', aspectRatio: ARTWORK_RATIO }}
        >
          <LinearGradient
            colors={['transparent', palette.ink[950]]}
            locations={[0.55, 0.95]}
            style={{ flex: 1 }}
          />
        </ImageBackground>
        <SafeAreaView className="flex-1">{children}</SafeAreaView>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={SKIES[variant]}
      locations={[0, 0.6]}
      style={{ flex: 1 }}
    >
      <SafeAreaView className="flex-1">{children}</SafeAreaView>
    </LinearGradient>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  /** Shows a spinner and blocks presses while an action is in flight. */
  loading?: boolean;
  size?: 'md' | 'sm';
  className?: string;
};

const BUTTON_STYLES = {
  primary: { box: 'bg-moon', text: 'text-ink-950', spinner: palette.ink[950] },
  secondary: {
    box: 'border border-moon/40 bg-ink-800/80',
    text: 'text-moon-100',
    spinner: palette.moon[100],
  },
  ghost: { box: '', text: 'text-ink-300', spinner: palette.ink[300] },
  danger: { box: 'bg-blood', text: 'text-white', spinner: '#fff' },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'md',
  className,
}: ButtonProps) {
  const style = BUTTON_STYLES[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      className={clsx(
        'flex-row items-center justify-center rounded-2xl',
        size === 'md' ? 'min-h-14 px-6' : 'min-h-10 px-4',
        style.box,
        inactive && 'opacity-40',
        className
      )}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.75 } : undefined)}
    >
      {loading && (
        <ActivityIndicator
          className="mr-2"
          color={style.spinner}
          size="small"
        />
      )}
      <Text
        className={clsx(
          'font-bold',
          size === 'md' ? 'text-lg' : 'text-sm',
          style.text
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A large centered text input on a translucent ink surface. */
export function Field({ className, ...props }: TextInputProps) {
  return (
    <TextInput
      className={clsx(
        'h-16 rounded-2xl border border-ink-500 bg-ink-900/90 px-4 text-center text-2xl font-bold text-moon-100',
        className
      )}
      placeholderTextColor={palette.ink[400]}
      selectionColor={palette.moon.DEFAULT}
      {...props}
    />
  );
}

const BANNER_TONES = {
  warning: { box: 'border-dawn/40 bg-dawn/15', text: 'text-dawn-300' },
  error: { box: 'border-blood/50 bg-blood/20', text: 'text-blood-300' },
  info: { box: 'border-ink-500 bg-ink-800/80', text: 'text-ink-200' },
};

/** A one-line status message: connection trouble, refusals, timeouts. */
export function Banner({
  tone,
  children,
  className,
}: {
  tone: keyof typeof BANNER_TONES;
  children: ReactNode;
  className?: string;
}) {
  const style = BANNER_TONES[tone];

  return (
    <View
      accessibilityLiveRegion="polite"
      className={clsx('rounded-xl border px-4 py-3', style.box, className)}
    >
      <Text className={clsx('text-center font-semibold', style.text)}>
        {children}
      </Text>
    </View>
  );
}

/** Small uppercase label above a value or a section. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={clsx(
        'text-xs font-semibold uppercase tracking-[2px] text-ink-300',
        className
      )}
    >
      {children}
    </Text>
  );
}

// Muted tints so each player is recognisable at a glance in lists
const AVATAR_TINTS = [
  '#5B7F86',
  '#7A6A9A',
  '#9A7A55',
  '#5F8A66',
  '#946068',
  '#56729A',
];

function tintFor(name: string) {
  let hash = 0;

  for (const char of name) {
    hash = (hash * 31 + char.charCodeAt(0)) % AVATAR_TINTS.length;
  }

  return AVATAR_TINTS[hash];
}

/** A player's initial in a colored disc; greyed out once they are dead. */
export function Avatar({
  name,
  size = 40,
  dead = false,
}: {
  name: string;
  size?: number;
  dead?: boolean;
}) {
  return (
    <View
      className="items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: dead ? palette.ink[600] : tintFor(name),
      }}
    >
      <Text className="font-bold text-white" style={{ fontSize: size * 0.42 }}>
        {dead ? '†' : name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}
