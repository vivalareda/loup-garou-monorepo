import { useNarratorStore } from '@/store/narrator';
import { socket } from '@/utils/socket';

/** Clips played but not yet reported done. */
const playingClipIds = new Set<string>();

/**
 * Makes this tab the game's narrator. Must run from a click: browsers only
 * let a page play audio after a user gesture.
 */
export function enableNarrator() {
  useNarratorStore.getState().setEnabled(true);
  socket.emit('narrator:register');
}

// The server forgets the narrator when its socket drops, and a register
// emitted while not connected is dropped: (re-)register on every connect
socket.on('connect', () => {
  if (useNarratorStore.getState().enabled) {
    socket.emit('narrator:register');
  }
});

socket.on('narrator:play', (clipId, clip) => {
  const { setCurrentClip } = useNarratorStore.getState();
  const audio = new Audio(`/audio/${encodeURI(clip)}.mp3`);
  playingClipIds.add(clipId);

  // A broken clip can both fire `error` and reject `play()`: report it once
  const finish = () => {
    if (!playingClipIds.delete(clipId)) {
      return;
    }

    if (useNarratorStore.getState().currentClip === clip) {
      setCurrentClip(null);
    }

    socket.emit('narrator:done', clipId);
  };

  setCurrentClip(clip);
  audio.addEventListener('ended', finish);
  // Missing clips (some segments have none yet) are skipped, like the
  // server-side player does
  audio.addEventListener('error', finish);
  audio.play().catch((error) => {
    console.error(`Narrator could not play ${clip}:`, error);
    finish();
  });
});
