import { type ClientWebSocket, createRealtimeClient } from '@repo/realtime';
import type { ServerToClientEvents } from '@repo/types';

const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 3;

type FakeListener = (event: { data: string; code: number }) => void;

/** One connection's WebSocket, opened, fed and dropped by the test. */
class FakeWebSocket implements ClientWebSocket {
  readyState = CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, FakeListener[]>();

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = CLOSED;
  }

  addEventListener(type: string, listener: FakeListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  /** `data` only matters for `message`, `code` only for `close`. */
  fire(type: string, data = '', code = 1000) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data, code });
    }
  }
}

/** A client→server frame as the wire carries it (`@repo/types` wire.ts). */
export type EmittedFrame = { event: string; args: unknown[] };

/**
 * The app's real socket client (`@repo/realtime`) talking to an in-memory
 * server the test drives: open and drop the connection, push server events
 * over the wire format, and read back what the client emitted. Pass
 * `server.socket` wherever the app passes its socket singleton.
 *
 * Reconnecting is left to the test (`connect()` again after `drop()`), and
 * the heartbeat is off, so no timer ever fires behind a test's back.
 */
export function createFakeGameServer() {
  const connections: FakeWebSocket[] = [];

  const socket = createRealtimeClient('ws://game.test/room/default', {
    autoConnect: false,
    reconnect: false,
    pingIntervalMs: 0,
    connectTimeoutMs: 0,
    WebSocket: class extends FakeWebSocket {
      constructor() {
        super();
        connections.push(this);
      }
    },
  });

  const current = () => {
    const [latest] = connections.slice(-1);

    if (!latest) {
      throw new Error('the client never connected');
    }

    return latest;
  };

  return {
    socket,

    /** Opens a connection: the client fires `connect`. */
    connect() {
      socket.connect();
      const connection = current();
      connection.readyState = OPEN;
      connection.fire('open');
    },

    /** A connection attempt is refused: the client fires `connect_error`. */
    refuse() {
      socket.connect();
      const connection = current();
      connection.readyState = CLOSED;
      connection.fire('close', '', 1006);
    },

    /** The network drops: the client fires `disconnect`. */
    drop() {
      const connection = current();
      connection.readyState = CLOSED;
      connection.fire('close', '', 1006);
    },

    /** Delivers a server event to the client, JSON-encoded as on the wire. */
    send<E extends keyof ServerToClientEvents>(
      event: E,
      ...args: Parameters<ServerToClientEvents[E]>
    ) {
      current().fire('message', JSON.stringify({ event, args }));
    },

    /** Every frame the client sent, over all its connections, in order. */
    emitted(): EmittedFrame[] {
      return connections.flatMap((connection) =>
        connection.sent.map((frame) => JSON.parse(frame))
      );
    },
  };
}

export type FakeGameServer = ReturnType<typeof createFakeGameServer>;
