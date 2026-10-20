import { RoomApiError } from '@repo/realtime';
import { isRoomCode, normalizeRoomCode } from '@repo/types';
import { useConnectionStore } from '@/hooks/use-connection-store';
import { useGameStore } from '@/hooks/use-game-store';
import { useModalStore } from '@/hooks/use-modal-store';
import { usePlayerStore } from '@/hooks/use-player-store';
import {
  clearSessionToken,
  getSessionRoom,
  getSessionToken,
  saveSessionRoom,
} from '@/utils/session';
import { connectToRoom, createRoom, roomExists, socket } from '@/utils/sockets';

/** Entering a room either worked (its code) or failed (a message to show). */
export type RoomEntry =
  | { ok: true; code: string }
  | { ok: false; error: string };

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
 * Counts room entries and exits. Async work started for one entry (a
 * session read, a relaunch restore) checks it is still current before
 * acting, so it never lands in a room the player has since moved to.
 */
let entry = 0;

/** The current room entry; compare it again after any await. */
export function currentRoomEntry() {
  return entry;
}

/**
 * Moves the app into room `code` over a new connection, even when it is
 * the room it is already in: each entry is a new client to the server.
 * A `fresh` entry (create or join from the room screen) drops the previous
 * session token, which belonged to an earlier entry; a `restored` one
 * (relaunch) keeps it to rejoin with. The code is remembered so a relaunch
 * can rejoin (see `restoreRoom`).
 */
function enterRoom(code: string, session: 'fresh' | 'restored') {
  entry += 1;
  clearLocalGame();
  if (session === 'fresh') {
    clearSessionToken().catch((error) => {
      console.error('Failed to clear session token', error);
    });
  }
  useConnectionStore.getState().setRoomCode(code);
  saveSessionRoom(code).catch((error) => {
    console.error('Failed to save the room code', error);
  });
  socket.disconnect();
  connectToRoom(code);
}

function describeRoomError(error: unknown) {
  if (error instanceof RoomApiError && error.status === 401) {
    return 'Accès refusé par le serveur.';
  }
  console.error('Room API call failed', error);
  return 'Serveur injoignable — réessayez dans un instant.';
}

/** Creates a private room, enters it, and resolves to its code. */
export async function createAndEnterRoom(): Promise<RoomEntry> {
  try {
    const code = await createRoom();
    enterRoom(code, 'fresh');
    return { ok: true, code };
  } catch (error) {
    return { ok: false, error: describeRoomError(error) };
  }
}

/**
 * Enters the room whose code the player typed (spaces, dashes and case
 * don't matter). A code with no room behind it is reported here, before
 * connecting: a refused socket looks like a network failure.
 */
export async function joinRoomByCode(input: string): Promise<RoomEntry> {
  const code = normalizeRoomCode(input);
  if (!isRoomCode(code)) {
    return { ok: false, error: 'Entrez le code de la partie.' };
  }
  try {
    if (!(await roomExists(code))) {
      return { ok: false, error: 'Aucune partie avec ce code.' };
    }
    enterRoom(code, 'fresh');
    return { ok: true, code };
  } catch (error) {
    return { ok: false, error: describeRoomError(error) };
  }
}

/** Leaves the current room for good: disconnected, game and session forgotten. */
export function leaveRoom() {
  entry += 1;
  socket.disconnect();
  clearLocalGame();
  useConnectionStore.getState().setRoomCode(null);
  clearSessionToken().catch((error) => {
    console.error('Failed to clear session token', error);
  });
}

/**
 * App launch: a player who had joined a room (a session token and its
 * room are saved) reconnects there, and use-session-recovery rejoins
 * with the token. Anyone else starts on the room screen.
 */
export async function restoreRoom() {
  const startedAt = entry;
  const [token, code] = await Promise.all([
    getSessionToken(),
    getSessionRoom(),
  ]);
  // The player already picked a room on the room screen meanwhile
  if (token && code && entry === startedAt) {
    enterRoom(code, 'restored');
  }
}

/** Groups a code for reading out: "K7MQ3XPD" → "K7MQ-3XPD". */
export function formatRoomCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
