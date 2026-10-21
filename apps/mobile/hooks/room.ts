import { RoomApiError, type RealtimeClient } from '@repo/realtime';
import { isRoomCode, normalizeRoomCode } from '@repo/types';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import type { StoredString } from '@/utils/ordered-storage';
import type { SessionTokens } from '@/utils/session';

/** Entering a room either worked (its code) or failed (a message to show). */
export type RoomEntry =
  | { ok: true; code: string }
  | { ok: false; error: string };

/** The server's room API, and pointing the socket at one room. */
export type RoomServer = {
  /** Creates a private room; resolves to its code. */
  create: () => Promise<string>;
  /** Whether room `code` exists (false for a wrong or expired code). */
  exists: (code: string) => Promise<boolean>;
  /** Connects the socket to room `code`. */
  connect: (code: string) => void;
};

/**
 * Forgets the local game: player, role, roster, votes, open prompt. Its
 * room's server may have reset it, or the app is changing rooms, and
 * nothing of it may leak into the next game (a stale role would send the
 * waiting room straight into the game interface).
 */
export function clearLocalGame() {
  useGameStore.getState().resetGame();
  usePlayerStore.getState().reset();
  useModalStore.getState().closeModal();
}

/**
 * Which room the app is in, and moving between rooms. The app has one
 * (`utils/rooms.ts`); tests build their own around a fake server and
 * in-memory storage.
 *
 * `savedRoom` remembers the room the session token belongs to, so a
 * relaunch can rejoin (see `restore`).
 */
export function createRooms(
  socket: RealtimeClient,
  server: RoomServer,
  sessions: SessionTokens,
  savedRoom: StoredString
) {
  /**
   * Counts room entries and exits. Async work started for one entry (a
   * session read, a relaunch restore) checks it is still current before
   * acting, so it never lands in a room the player has since moved to.
   */
  let entry = 0;

  /**
   * Moves the app into room `code` over a new connection, even when it is
   * the room it is already in: each entry is a new client to the server.
   * A `fresh` entry (create or join from the room screen) drops the
   * previous session token, which belonged to an earlier entry; a
   * `restored` one (relaunch) keeps it to rejoin with.
   */
  function enter(code: string, session: 'fresh' | 'restored') {
    entry += 1;
    clearLocalGame();

    if (session === 'fresh') {
      sessions.clear().catch((error) => {
        console.error('Failed to clear session token', error);
      });
    }

    useConnectionStore.getState().setRoomCode(code);
    savedRoom.save(code).catch((error) => {
      console.error('Failed to save the room code', error);
    });
    socket.disconnect();
    server.connect(code);
  }

  /**
   * Asks the room API which room to enter (`find`), then enters it fresh.
   * A refused access token and an unreachable server become messages.
   */
  async function enterFound(
    find: () => Promise<RoomEntry>
  ): Promise<RoomEntry> {
    try {
      const found = await find();

      if (found.ok) {
        enter(found.code, 'fresh');
      }

      return found;
    } catch (error) {
      if (error instanceof RoomApiError && error.status === 401) {
        return { ok: false, error: 'Accès refusé par le serveur.' };
      }

      console.error('Room API call failed', error);

      return {
        ok: false,
        error: 'Serveur injoignable — réessayez dans un instant.',
      };
    }
  }

  /** Leaves the current room for good: disconnected, game and session forgotten. */
  function leave() {
    entry += 1;
    socket.disconnect();
    clearLocalGame();
    useConnectionStore.getState().setRoomCode(null);
    sessions.clear().catch((error) => {
      console.error('Failed to clear session token', error);
    });
  }

  return {
    /** The current room entry; compare it again after any await. */
    currentEntry: () => entry,

    leave,

    /** Creates a private room, enters it, and resolves to its code. */
    createAndEnter: () =>
      enterFound(async () => ({ ok: true, code: await server.create() })),

    /**
     * Enters the room whose code the player typed (spaces, dashes and case
     * don't matter). A code with no room behind it is reported here, before
     * connecting: a refused socket looks like a network failure.
     */
    joinByCode(input: string): Promise<RoomEntry> {
      const code = normalizeRoomCode(input);

      if (!isRoomCode(code)) {
        return Promise.resolve({
          ok: false,
          error: 'Entrez le code de la partie.',
        });
      }

      return enterFound(async () =>
        (await server.exists(code))
          ? { ok: true, code }
          : { ok: false, error: 'Aucune partie avec ce code.' }
      );
    },

    /**
     * Leaves room `code` if the server no longer has it (it expired while
     * the phone slept) and the app is still in it; resolves to whether it
     * left. Rejects when the server is unreachable.
     */
    async leaveIfGone(code: string) {
      const exists = await server.exists(code);

      const gone = !exists && useConnectionStore.getState().roomCode === code;

      if (gone) {
        leave();
      }

      return gone;
    },

    /**
     * App launch: a player who had joined a room (a session token and its
     * room are saved) reconnects there, and session recovery rejoins with
     * the token. Anyone else starts on the room screen.
     */
    async restore() {
      const startedAt = entry;

      const [token, code] = await Promise.all([
        sessions.get(),
        savedRoom.get(),
      ]);

      // The player already picked a room on the room screen meanwhile
      if (token && code && entry === startedAt) {
        enter(code, 'restored');
      }
    },
  };
}

export type Rooms = ReturnType<typeof createRooms>;

/** Groups a code for reading out: "K7MQ3XPD" → "K7MQ-3XPD". */
export function formatRoomCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
