import { RoomApiError } from '@repo/realtime';
import { isRoomCode, normalizeRoomCode } from '@repo/types';
import { useConnectionStore } from '@/hooks/use-connection-store';
import {
  clearSessionToken,
  getSessionRoom,
  getSessionToken,
  saveSessionRoom,
} from '@/utils/session';
import { connectToRoom, createRoom, roomExists, socket } from '@/utils/sockets';

/** Entering a room either worked (its code) or failed (a message to show). */
export type RoomEntry = { ok: true; code: string } | { ok: false; error: string };

/**
 * Moves the app into room `code`: the socket connects there, and the code
 * is remembered so a relaunch can rejoin it (see `restoreRoom`).
 */
function enterRoom(code: string) {
  useConnectionStore.getState().setRoomCode(code);
  saveSessionRoom(code).catch((error) => {
    console.error('Failed to save the room code', error);
  });
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
    enterRoom(code);
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
    enterRoom(code);
    return { ok: true, code };
  } catch (error) {
    return { ok: false, error: describeRoomError(error) };
  }
}

/** Leaves the current room for good: disconnected, session forgotten. */
export function leaveRoom() {
  socket.disconnect();
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
  const [token, code] = await Promise.all([getSessionToken(), getSessionRoom()]);
  if (token && code) {
    enterRoom(code);
  }
}

/** Groups a code for reading out: "K7MQ3XPD" → "K7MQ-3XPD". */
export function formatRoomCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}
