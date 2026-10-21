import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { registerGameEventListeners } from '@/hooks/game-events';
import { sessionTokens } from '@/utils/session';
import { socket } from '@/utils/sockets';

export function useGameEvents() {
  const router = useRouter();

  useEffect(
    () =>
      registerGameEventListeners(
        { replace: (path) => router.replace(path) },
        socket,
        sessionTokens
      ),
    [router]
  );
}
