import { DurableObject } from 'cloudflare:workers';
import { createGameRuntime } from '@/game-runtime';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { WebSocketHost } from '@/server/websocket-host';
import { isWebSocketUpgrade, upgradeRequired } from './room-route';

/**
 * One game room: a single in-memory game shared by every socket of the
 * same room code. Nothing is persisted, so the game lives as long as the
 * object does (while it has sockets or pending game timers; a deploy
 * resets it).
 *
 * The sockets are accepted with `accept()`, not the hibernation API: the
 * game's timers keep the object awake anyway, and hibernating would drop
 * the in-memory game.
 */
export class GameRoom extends DurableObject<Env> {
  private host: WebSocketHost | undefined;

  override fetch(request: Request): Response {
    if (!isWebSocketUpgrade(request)) {
      return upgradeRequired();
    }
    // biome-ignore lint/correctness/noUndeclaredVariables: a workerd global
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    this.room().accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Builds the game on the first connection. No speakers here: clips go
   * to the dashboard tab that registers as narrator (or are skipped).
   */
  private room() {
    if (!this.host) {
      const host = new WebSocketHost();
      createGameRuntime({ host, narrator: new DashboardNarrator(host) });
      this.host = host;
    }
    return this.host;
  }
}
