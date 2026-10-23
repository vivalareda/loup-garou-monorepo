import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Backdrop, Banner, Button, Field } from '@/components/ui';
import type { RoomEntry } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { rooms } from '@/utils/rooms';

/**
 * The first screen: create a private room, or join one with the code its
 * creator shared. Either way the app connects to that room and moves on
 * to its name form (join.tsx).
 */
export default function RoomScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const { recoveryFailed, setRecoveryFailed } = useConnectionStore();

  const enter = async (
    kind: 'create' | 'join',
    attempt: () => Promise<RoomEntry>
  ) => {
    if (busy) {
      return;
    }

    Keyboard.dismiss();
    setRecoveryFailed(false);
    setError(null);
    setBusy(kind);
    const entry = await attempt();
    setBusy(null);

    if (entry.ok) {
      router.push('/join');
    } else {
      setError(entry.error);
    }
  };

  const joinByCode = () => enter('join', () => rooms.joinByCode(code));

  return (
    <Backdrop variant="artwork">
      {/* Tapping outside the field closes the keyboard; not an a11y target */}
      <Pressable
        accessible={false}
        className="flex-1"
        onPress={Keyboard.dismiss}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1 justify-end px-6 pb-6"
        >
          <View className="gap-3">
            {recoveryFailed && (
              <Banner tone="warning">
                Cette partie n'existe plus — créez-en une autre.
              </Banner>
            )}
            {error && <Banner tone="error">{error}</Banner>}

            <Button
              disabled={busy === 'join'}
              label="Créer une partie"
              loading={busy === 'create'}
              onPress={() => enter('create', () => rooms.createAndEnter())}
            />

            <View className="my-3 flex-row items-center gap-3">
              <View className="h-px flex-1 bg-ink-600" />
              <Text className="text-sm text-ink-300">
                ou rejoindre avec un code
              </Text>
              <View className="h-px flex-1 bg-ink-600" />
            </View>

            <Field
              accessibilityLabel="Code de la partie"
              autoCapitalize="characters"
              autoCorrect={false}
              className="tracking-[4px]"
              onChangeText={setCode}
              onSubmitEditing={joinByCode}
              placeholder="ABCD-2345"
              returnKeyType="go"
              value={code}
            />
            <Button
              disabled={busy === 'create' || code.trim() === ''}
              label="Rejoindre"
              loading={busy === 'join'}
              onPress={joinByCode}
              variant="secondary"
            />
          </View>
        </KeyboardAvoidingView>
      </Pressable>
    </Backdrop>
  );
}
