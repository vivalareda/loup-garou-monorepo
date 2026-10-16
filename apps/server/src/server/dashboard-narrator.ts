import type { Narrator } from '@/segments/narrator';
import type { Broadcaster } from '@/server/broadcaster';
import type { SocketType } from '@/server/sockets';

/**
 * Upper bound on one clip. If the dashboard never reports `narrator:done`
 * (tab throttled, decode stalled), the game moves on instead of hanging.
 */
const CLIP_TIMEOUT_MS = 60_000;

/**
 * Sends clips to the dashboard registered as narrator and waits for it to
 * report each one finished. With no narrator connected, clips are skipped
 * so the game never blocks on audio.
 */
export class DashboardNarrator implements Narrator {
  private narratorSocketId: string | undefined;
  private nextClipId = 0;
  private readonly pending = new Map<string, () => void>();
  private readonly io: Broadcaster;
  private readonly clipTimeoutMs: number;

  constructor(io: Broadcaster, clipTimeoutMs = CLIP_TIMEOUT_MS) {
    this.io = io;
    this.clipTimeoutMs = clipTimeoutMs;
  }

  /** Handles the narrator events on every Socket.io connection. */
  listen(io: SocketType) {
    io.on('connection', (socket) => {
      socket.on('narrator:register', () => this.attach(socket.id));
      socket.on('narrator:done', (clipId) => this.complete(clipId));
      socket.on('disconnect', () => this.detach(socket.id));
    });
  }

  /** The latest dashboard to register takes over narration. */
  attach(socketId: string) {
    console.log(`[NARRATOR] ${socketId} is now the narrator`);
    this.narratorSocketId = socketId;
  }

  detach(socketId: string) {
    if (this.narratorSocketId !== socketId) {
      return;
    }
    console.log(`[NARRATOR] ${socketId} left, clips will be skipped`);
    this.narratorSocketId = undefined;
    // The clips in flight will never be acknowledged
    for (const finish of [...this.pending.values()]) {
      finish();
    }
  }

  complete(clipId: string) {
    this.pending.get(clipId)?.();
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
        this.pending.delete(clipId);
        resolve();
      };
      const timer = setTimeout(() => {
        console.warn(`[NARRATOR] ${clip} timed out, moving on`);
        finish();
      }, this.clipTimeoutMs);

      this.pending.set(clipId, finish);
      this.io.to(socketId).emit('narrator:play', clipId, clip);
    });
  }
}
