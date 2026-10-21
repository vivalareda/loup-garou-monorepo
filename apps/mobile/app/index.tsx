import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Text, View } from 'react-native';
import { Banner } from '@/components/ui/banner';
import { FadeIn } from '@/components/ui/fade-in';
import { Field } from '@/components/ui/field';
import { ForestScreen } from '@/components/ui/forest-screen';
import { PrimaryButton } from '@/components/ui/primary-button';
import type { RoomEntry } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { palette } from '@/lib/theme';
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
  const [busy, setBusy] = useState(false);
  const { recoveryFailed, setRecoveryFailed } = useConnectionStore();

  const enter = async (attempt: () => Promise<RoomEntry>) => {
    if (busy) {
      return;
    }

    Keyboard.dismiss();
    setRecoveryFailed(false);
    setError(null);
    setBusy(true);
    const entry = await attempt();
    setBusy(false);

    if (entry.ok) {
      router.push('/join');
    } else {
      setError(entry.error);
    }
  };

  return (
    <ForestScreen dismissKeyboard>
      <View className="flex-1 justify-end px-8 pb-10">
        <FadeIn delayMs={120}>
          <View className="w-full max-w-sm self-center">
            {recoveryFailed && (
              <Banner
                message="Cette partie n'existe plus — créez-en une autre."
                tone="warn"
              />
            )}
            {error && <Banner message={error} tone="danger" />}

            <PrimaryButton
              disabled={busy}
              label={busy ? 'Connexion…' : 'Créer une partie'}
              onPress={() => enter(() => rooms.createAndEnter())}
            />

            <View className="my-7 flex-row items-center gap-3">
              <View
                className="h-px flex-1"
                style={{ backgroundColor: 'rgba(230, 231, 212, 0.22)' }}
              />
              <Text
                style={{
                  color: palette.moonDim,
                  fontFamily: 'Outfit_500Medium',
                  fontSize: 12,
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                ou rejoindre
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: 'rgba(230, 231, 212, 0.22)' }}
              />
            </View>

            <Field
              autoCapitalize="characters"
              autoCorrect={false}
              label="Code de la partie"
              onChangeText={setCode}
              onSubmitEditing={() => enter(() => rooms.joinByCode(code))}
              placeholder="ABCD-2345"
              value={code}
            />

            <View className="mt-4">
              <PrimaryButton
                disabled={busy}
                label={busy ? 'Connexion…' : 'Rejoindre'}
                onPress={() => enter(() => rooms.joinByCode(code))}
                variant="ghost"
              />
            </View>
          </View>
        </FadeIn>
      </View>
    </ForestScreen>
  );
}
