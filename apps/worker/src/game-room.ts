import { DurableObject } from 'cloudflare:workers';
import { createGameRuntime, type GameRuntime } from '@/game-runtime';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { WebSocketHost } from '@/server/websocket-host';
import { isWebSocketUpgrade, upgradeRequired } from './room-route';

const DEFAULT_MAX_CONNECTIONS = 32;
/** Storage key marking this object's code as a created room. */
const CREATED_AT = 'createdAt';
/** How long a room nobody is connected to survives before it is deleted. */
const EMPTY_ROOM_TTL_MS = 15 * 60_000;

/** A positive integer var, or the default when unset or invalid. */
function positiveInt(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

type Room = { host: WebSocketHost; runtime: GameRuntime };

/**
 * One game room: a single in-memory game shared by every socket of the
 * same room code.
 *
 * A code is a room only once `create()` claimed it (`POST /rooms`): that
 * mark is the one thing persisted, so a room survives eviction while its
 * code is being shared, and sockets to any other code get a 404. A room
 * nobody is connected to expires after EMPTY_ROOM_TTL_MS (an alarm) and
 * its code stops working. The game itself is in memory only: it lives as
 * long as the object does (while it has sockets or pending game timers; a
 * deploy resets it).
 *
 * The sockets are accepted with `accept()`, not the hibernation API: the
 * game's timers keep the object awake anyway, and hibernating would drop
 * the in-memory game.
 */
export class GameRoom extends DurableObject<Env> {
  private room: Room | undefined;

  /**
   * Claims this object's code for a new room (RPC from `POST /rooms`).
   * False when the code is already a room: the caller draws another.
   */
  async create(): Promise<boolean> {
    if (this.exists()) {
      return false;
    }
    this.ctx.storage.kv.put(CREATED_AT, Date.now());
    // Expires unless someone connects meanwhile
    await this.scheduleExpiry();
    return true;
  }

  /** Whether this code is a created room that has not expired (RPC). */
  exists(): boolean {
    return this.ctx.storage.kv.get(CREATED_AT) !== undefined;
  }

  override fetch(request: Request): Response {
    if (!isWebSocketUpgrade(request)) {
      return upgradeRequired();
    }
    if (!this.exists()) {
      return new Response('No such room', { status: 404 });
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
        connection.on('disconnect', () => this.handleLeave());
      });
      this.room = { host, runtime };
    }
    return this.room;
  }

  /**
   * When the last socket leaves, the room's expiry starts. A lobby or a
   * finished game also starts over, so no player or timer is left to keep
   * the object awake; a game in progress is kept for its players'
   * reconnect grace.
   */
  private handleLeave() {
    const room = this.room;
    if (!room || room.host.size > 0) {
      return;
    }
    this.scheduleExpiry().catch((error) => {
      console.error('Could not schedule the room expiry:', error);
    });
    if (!this.isPlaying(room)) {
      console.log('Room is empty, resetting it');
      room.runtime.reset();
    }
  }

  /**
   * The expiry alarm. A room someone is connected to is left alone (the
   * last one to leave schedules the next check), and a game in progress
   * waits until it ends; otherwise the room is deleted and its code no
   * longer admits anyone.
   */
  override async alarm() {
    const room = this.room;
    if (room && room.host.size > 0) {
      return;
    }
    if (room && this.isPlaying(room)) {
      await this.scheduleExpiry();
      return;
    }
    console.log('Room expired');
    this.room = undefined;
    await this.ctx.storage.deleteAll();
  }

  private scheduleExpiry() {
    return this.ctx.storage.setAlarm(Date.now() + EMPTY_ROOM_TTL_MS);
  }

  private isPlaying({ runtime }: Room) {
    return (
      runtime.segmentsManager.hasStarted() &&
      !runtime.segmentsManager.hasFinished()
    );
  }
}
