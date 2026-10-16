import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sound from 'sound-play';
import type { Narrator } from './narrator';

// The clips live with the dashboard, which serves them to the browser
// narrator; resolved from this file so it doesn't depend on the cwd
const AUDIO_DIR = fileURLToPath(
  new URL('../../../dashboard/public/audio/', import.meta.url)
);

/** Plays clips on the server machine's speakers. */
export class LocalNarrator implements Narrator {
  async play(clip: string) {
    const file = `${AUDIO_DIR}${clip}.mp3`;
    const exists = existsSync(file);

    // DEBUG_AUDIO=1 logs the file that would have played instead of playing
    // it, so segment/audio ordering can be checked without sitting through
    // the recordings
    if (process.env.DEBUG_AUDIO) {
      console.log(
        `[AUDIO] Would play: ${clip}${exists ? '' : ' (missing asset!)'}`
      );
      return;
    }

    try {
      if (!exists) {
        return;
      }
      await sound.play(file);
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }
}
