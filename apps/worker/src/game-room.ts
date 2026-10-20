import { DurableObject } from 'cloudflare:workers';
import { createGameRuntime, type GameRuntime } from '@/game-runtime';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { WebSocketHost } from '@/server/websocket-host';
import { isWebSocketUpgrade, upgradeRequired } from './room-route';

const DEFAULT_MAX_CONNECTIONS = 32;

/** A positive integer var, or the default when unset or invalid. */
function positiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

type Room = { host: WebSocketHost; runtime: GameRuntime };

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
  private room: Room | undefined;

  override fetch(request: Request): Response {
    if (!isWebSocketUpgrade(request)) {
      return upgradeRequired();
    }
    const { host } = this.getRoom();
    const maxConnections = positiveInt(
      this.env.MAX_CONNECTIONS_PER_ROOM,
      DEFAULT_MAX_CONNECTIONS
    );
    if (host.size >= maxConnections) {
      return new Response('Room is full', { status: 503 });
    }
    // biome-ignore lint/correctness/noUndeclaredVariables: a workerd global
    const { 0: client, 1: server } = new WebSocketPair();
    server.accept();
    host.accept(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * Builds the game on the first connection. No speakers here: clips go
   * to the dashboard tab that registers as narrator (or are skipped).
   * The admin:* testing tools are off unless ENABLE_ADMIN_EVENTS is "true".
   */
  private getRoom(): Room {
    if (!this.room) {
      const host = new WebSocketHost();
      const runtime = createGameRuntime({
        host,
        narrator: new DashboardNarrator(host),
        adminEvents: this.env.ENABLE_ADMIN_EVENTS === 'true',
      });
      // Registered after the game's own handlers, so a lobby player who
      // left is already removed when this runs
      host.on('connection', (connection) => {
        connection.on('disconnect', () => this.resetIfAbandoned());
      });
      this.room = { host, runtime };
    }
    return this.room;
  }

  /**
   * The last socket left a lobby or a finished game: start over, so no
   * player or timer is left to keep the object awake. A game in progress
   * is kept for its players' reconnect grace.
   */
  private resetIfAbandoned() {
    const room = this.room;
    if (!room || room.host.size > 0) {
      return;
    }
    const { segmentsManager } = room.runtime;
    if (!segmentsManager.hasStarted() || segmentsManager.hasFinished()) {
      console.log('Room is empty, resetting it');
      room.runtime.reset();
    }
  }
}
