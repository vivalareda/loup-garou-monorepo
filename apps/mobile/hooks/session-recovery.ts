import type { RealtimeClient } from '@repo/realtime';
import { applyGameSnapshot, type SnapshotRouter } from '@/hooks/game-snapshot';
import { clearLocalGame, type Rooms } from '@/hooks/room';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import type { SessionTokens } from '@/utils/session';

function onDisconnect() {
  useConnectionStore.getState().setStatus('reconnecting');
}

/**
 * Registers the connection lifecycle listeners and returns their cleanup.
 * Mounted ONCE at the app root: whenever the socket (re)connects and a
 * session token exists, the player silently re-identifies with
 * `player:rejoin` and the resulting `game:snapshot` rebuilds their state —
 * so a locked phone or a backgrounded Expo Go no longer loses the seat.
 */
export function registerSessionRecovery(
  router: SnapshotRouter,
  socket: RealtimeClient,
  sessions: SessionTokens,
  rooms: Pick<Rooms, 'currentEntry' | 'leaveIfGone'>
) {
  /** Drops every trace of the game and sends the player to `route`. */
  const resetToScreen = (route: '/' | '/join') => {
    useConnectionStore.getState().setStatus('unrecoverable');
    useConnectionStore.getState().setRecoveryFailed(true);
    clearLocalGame();
    router.replace(route);
  };

  const onConnect = () => {
    useConnectionStore.getState().setStatus('connected');
    // A token read that finishes after a room change belongs to the old
    // room: sending it would only get the new room's seat reset
    const entry = rooms.currentEntry();
    sessions
      .get()
      .then((token) => {
        if (token && rooms.currentEntry() === entry) {
          socket.emit('player:rejoin', token);
        }
      })
      .catch((error) => {
        console.error('Failed to read session token', error);
      });
  };

  const onSnapshot = (snapshot: Parameters<typeof applyGameSnapshot>[0]) => {
    useConnectionStore.getState().setRecoveryFailed(false);
    applyGameSnapshot(snapshot, router, sessions);
  };

  const onRejoinFailed = () => {
    sessions.clear().catch((error) => {
      console.error('Failed to clear session token', error);
    });

    // The room is still there (this answer came from it), only the seat
    // is gone: back to its join screen with an explanation, whether the
    // player was mid-game or relaunched the app (rooms.restore) on the
    // room screen
    if (
      usePlayerStore.getState().player !== null ||
      useConnectionStore.getState().roomCode !== null
    ) {
      resetToScreen('/join');
    }
  };

  // A refused reconnect may mean the room itself is gone (it expired while
  // the phone slept): then stop retrying and go back to the room screen.
  // One check at a time, as failed attempts repeat every few seconds
  let checkingRoom = false;

  const onConnectError = () => {
    const { roomCode } = useConnectionStore.getState();

    if (!roomCode || checkingRoom) {
      return;
    }

    checkingRoom = true;
    rooms
      .leaveIfGone(roomCode)
      .then((left) => {
        if (left) {
          resetToScreen('/');
        }
      })
      .catch(() => {
        // Server unreachable: keep reconnecting
      })
      .finally(() => {
        checkingRoom = false;
      });
  };

  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);
  socket.on('game:snapshot', onSnapshot);
  socket.on('player:rejoin-failed', onRejoinFailed);
  socket.on('connect_error', onConnectError);

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
    socket.off('connect_error', onConnectError);
  };
}
