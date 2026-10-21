import type { Narrator } from '@/segments/narrator';
import type { Broadcaster } from '@/server/broadcaster';

/**
 * Upper bound on one clip. If the dashboard never reports `narrator:done`
 * (tab throttled, decode stalled), the game moves on instead of hanging.
 */
const CLIP_TIMEOUT_MS = 60_000;

type InFlightClip = { socketId: string; finish: () => void };

/**
 * Sends clips to the dashboard registered as narrator and waits for it to
 * report each one finished. With no narrator connected, clips are skipped
 * so the game never blocks on audio. Transport-agnostic: the host forwards
 * `narrator:register` / `narrator:done` / disconnects to `attach` /
 * `complete` / `detach`.
 */
export class DashboardNarrator implements Narrator {
  private narratorSocketId: string | undefined;
  private nextClipId = 0;
  private readonly inFlight = new Map<string, InFlightClip>();
  private readonly io: Broadcaster;
  private readonly clipTimeoutMs: number;

  constructor(io: Broadcaster, clipTimeoutMs = CLIP_TIMEOUT_MS) {
    this.io = io;
    this.clipTimeoutMs = clipTimeoutMs;
  }

  /**
   * The latest dashboard to register takes over narration. Clips already
   * sent to the previous one still finish when it reports them or leaves.
   */
  attach(socketId: string) {
    console.log(`[NARRATOR] ${socketId} is now the narrator`);
    this.narratorSocketId = socketId;
  }

  detach(socketId: string) {
    if (this.narratorSocketId === socketId) {
      console.log(`[NARRATOR] ${socketId} left, clips will be skipped`);
      this.narratorSocketId = undefined;
    }

    // Clips sent to this socket will never be acknowledged
    for (const clip of [...this.inFlight.values()]) {
      if (clip.socketId === socketId) {
        clip.finish();
      }
    }
  }

  /** Only the socket a clip was sent to can report it done. */
  complete(socketId: string, clipId: string) {
    const clip = this.inFlight.get(clipId);

    if (clip?.socketId === socketId) {
      clip.finish();
    }
  }

  play(clip: string) {
    const socketId = this.narratorSocketId;

    if (socketId === undefined) {
      console.warn(`[NARRATOR] No narrator connected, skipping ${clip}`);

      return Promise.resolve();
    }

    const clipId = String(this.nextClipId++);

    return new Promise<void>((resolve) => {
      const finish = () => {
        clearTimeout(timer);
        this.inFlight.delete(clipId);
        resolve();
      };

      const timer = setTimeout(() => {
        console.warn(`[NARRATOR] ${clip} timed out, moving on`);
        finish();
      }, this.clipTimeoutMs);

      this.inFlight.set(clipId, { socketId, finish });
      this.io.to(socketId).emit('narrator:play', clipId, clip);
    });
  }
}
