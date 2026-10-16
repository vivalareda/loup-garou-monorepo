import type { Server as HttpServer } from 'node:http';
import { parseRoomPath } from '@repo/types';
import { type WebSocket, WebSocketServer } from 'ws';
import type { WebSocketHost } from '@/server/websocket-host';

/** Socket.io's former `maxHttpBufferSize`: no game frame comes close. */
const MAX_PAYLOAD_BYTES = 1_000_000;

export type WebSocketServerOptions = {
  /**
   * How often every client is pinged. A client that has not answered the
   * previous ping by the next one is terminated, so a dead phone is
   * noticed within one to two intervals and its `disconnect` (and the
   * grace timer) still fires.
   */
  heartbeatIntervalMs: number;
};

/**
 * Serves the WebSocket endpoint on the Node http server: upgrades on
 * `/room/<code>` go to `host`, any other path is refused. The Node server
 * hosts a single game, so the room code is not used yet.
 */
export function attachWebSocketServer(
  httpServer: HttpServer,
  host: WebSocketHost,
  options: WebSocketServerOptions
) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: MAX_PAYLOAD_BYTES,
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = (request.url ?? '').split('?')[0] ?? '';
    if (parseRoomPath(pathname) === null) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  // Browsers, React Native and Node answer protocol-level pings on their
  // own, so the clients need no heartbeat code
  const awaitingPong = new WeakSet<WebSocket>();
  wss.on('connection', (ws) => {
    ws.on('pong', () => awaitingPong.delete(ws));
    host.accept(ws);
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (awaitingPong.has(ws)) {
        // `terminate` fires `close`, which the host turns into `disconnect`
        ws.terminate();
        continue;
      }
      awaitingPong.add(ws);
      ws.ping();
    }
  }, options.heartbeatIntervalMs);
  heartbeat.unref();
  wss.on('close', () => clearInterval(heartbeat));

  return wss;
}
