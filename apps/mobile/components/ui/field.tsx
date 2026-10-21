import { Text, TextInput, View } from 'react-native';
import { palette } from '@/lib/theme';

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
};

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  autoCorrect = true,
  onSubmitEditing,
}: FieldProps) {
  return (
    <View className="w-full">
      <Text
        className="mb-3 text-center text-sm uppercase tracking-[2px]"
        style={{ color: palette.moonDim, fontFamily: 'Outfit_500Medium' }}
      >
        {label}
      </Text>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor="rgba(184, 186, 163, 0.55)"
        style={{
          height: 60,
          width: '100%',
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: 'rgba(230, 231, 212, 0.28)',
          backgroundColor: 'rgba(11, 18, 22, 0.55)',
          color: palette.snow,
          textAlign: 'center',
          fontSize: 22,
          fontFamily: 'Outfit_600SemiBold',
          letterSpacing: 1,
        }}
        value={value}
      />
    </View>
  );
}
