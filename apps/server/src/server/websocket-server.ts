import type { Server as HttpServer } from 'node:http';
import { parseRoomPath } from '@repo/types';
import { WebSocketServer } from 'ws';
import type { WebSocketHost } from '@/server/websocket-host';

/**
 * Serves the WebSocket endpoint on the Node http server: upgrades on
 * `/room/<code>` go to `host`, any other path is refused. The Node server
 * hosts a single game, so the room code is not used.
 *
 * Liveness is the host's job (the app-level ping/pong of wire.ts and its
 * idle timeout), the same on Node and in a Durable Object, so no protocol
 * pings are sent here.
 */
export function attachWebSocketServer(
  httpServer: HttpServer,
  host: WebSocketHost
) {
  const wss = new WebSocketServer({
    noServer: true,
    // Same limit as the host's own check, enforced while reading the frame
    maxPayload: host.maxFrameBytes,
  });

  httpServer.on('upgrade', (request, socket, head) => {
    const pathname = (request.url ?? '').split('?')[0] ?? '';
    if (parseRoomPath(pathname) === null) {
      socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) => {
      host.accept(ws);
    });
  });

  return wss;
}
