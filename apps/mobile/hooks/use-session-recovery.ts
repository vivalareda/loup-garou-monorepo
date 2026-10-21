import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { registerSessionRecovery } from '@/hooks/session-recovery';
import { rooms } from '@/utils/rooms';
import { sessionTokens } from '@/utils/session';
import { socket } from '@/utils/sockets';

export function useSessionRecovery() {
  const router = useRouter();

  useEffect(
    () =>
      registerSessionRecovery(
        { replace: (path) => router.replace(path) },
        socket,
        sessionTokens,
        rooms
      ),
    [router]
  );
}
