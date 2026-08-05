import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { applyGameSnapshot, type SnapshotRouter } from '@/hooks/game-snapshot';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import { clearSessionToken, getSessionToken } from '@/utils/session';
import { socket } from '@/utils/sockets';

/**
 * Registers the connection lifecycle listeners and returns their cleanup.
 * Mounted ONCE at the app root: whenever the socket (re)connects and a
 * session token exists, the player silently re-identifies with
 * `player:rejoin` and the resulting `game:snapshot` rebuilds their state —
 * so a locked phone or a backgrounded Expo Go no longer loses the seat.
 */
export function registerSessionRecovery(router: SnapshotRouter) {
  const onConnect = () => {
    useConnectionStore.getState().setStatus('connected');
    getSessionToken()
      .then((token) => {
        if (token) {
          socket.emit('player:rejoin', token);
        }
      })
      .catch((error) => {
        console.error('Failed to read session token', error);
      });
  };

  const onDisconnect = () => {
    useConnectionStore.getState().setStatus('reconnecting');
  };

  const onSnapshot = (snapshot: Parameters<typeof applyGameSnapshot>[0]) => {
    useConnectionStore.getState().setRecoveryFailed(false);
    applyGameSnapshot(snapshot, router);
  };

  const onRejoinFailed = () => {
    clearSessionToken().catch((error) => {
      console.error('Failed to clear session token', error);
    });

    // Only disruptive when we were actually in a game: reset everything
    // and land back on the join screen with an explanation
    if (usePlayerStore.getState().player !== null) {
      useConnectionStore.getState().setStatus('unrecoverable');
      useConnectionStore.getState().setRecoveryFailed(true);
      useGameStore.getState().resetGame();
      usePlayerStore.getState().reset();
      useModalStore.getState().closeModal();
      router.replace('/');
    }
  };

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('game:snapshot', onSnapshot);
  socket.on('player:rejoin-failed', onRejoinFailed);

  // The socket may have connected before these listeners existed (app cold
  // start): attempt the initial session restore explicitly
  if (socket.connected) {
    onConnect();
  }

  return () => {
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
    socket.off('game:snapshot', onSnapshot);
    socket.off('player:rejoin-failed', onRejoinFailed);
  };
}

export function useSessionRecovery() {
  const router = useRouter();

  useEffect(
    () =>
      registerSessionRecovery({
        replace: (path) => router.replace(path),
      }),
    [router]
  );
}
