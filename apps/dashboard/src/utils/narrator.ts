import { socket } from '@/utils/socket';

type NarratorState = { enabled: boolean; currentClip: string | undefined };

let state: NarratorState = { enabled: false, currentClip: undefined };
const listeners = new Set<() => void>();
/** Clips played but not yet reported done. */
const playingClipIds = new Set<string>();

const setState = (next: Partial<NarratorState>) => {
  state = { ...state, ...next };
  for (const listener of listeners) {
    listener();
  }
};

export const narratorStore = {
  getState: () => state,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

/**
 * Makes this tab the game's narrator. Must run from a click: browsers only
 * let a page play audio after a user gesture.
 */
export function enableNarrator() {
  setState({ enabled: true });
  socket.emit('narrator:register');
}

// The server forgets the narrator when its socket drops
socket.on('connect', () => {
  if (state.enabled) {
    socket.emit('narrator:register');
  }
});

socket.on('narrator:play', (clipId, clip) => {
  const audio = new Audio(`/audio/${encodeURI(clip)}.mp3`);
  playingClipIds.add(clipId);
  // A broken clip can both fire `error` and reject `play()`: report it once
  const finish = () => {
    if (!playingClipIds.delete(clipId)) {
      return;
    }
    if (state.currentClip === clip) {
      setState({ currentClip: undefined });
    }
    socket.emit('narrator:done', clipId);
  };

  setState({ currentClip: clip });
  audio.addEventListener('ended', finish);
  // Missing clips (some segments have none yet) are skipped, like the
  // server-side player does
  audio.addEventListener('error', finish);
  audio.play().catch((error: unknown) => {
    console.error(`Narrator could not play ${clip}:`, error);
    finish();
  });
});
