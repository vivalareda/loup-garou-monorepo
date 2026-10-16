import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createRealtimeClient } from '@repo/realtime';
import type { PlayerGameSnapshot } from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebSocket, type WebSocketServer } from 'ws';
import type { Connection } from '@/server/connection';
import { WebSocketHost } from '@/server/websocket-host';
import { attachWebSocketServer } from '@/server/websocket-server';

const IDLE_MS = 80;

describe('attachWebSocketServer', () => {
  let httpServer: HttpServer;
  let wss: WebSocketServer;
  let host: WebSocketHost;
  let base: string;
  const clients: { close(): void }[] = [];

  beforeEach(async () => {
    httpServer = createServer();
    host = new WebSocketHost({ idleTimeoutMs: IDLE_MS, maxFrameBytes: 1024 });
    wss = attachWebSocketServer(httpServer, host);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = httpServer.address() as AddressInfo;
    base = `ws://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      client.close();
    }
    for (const ws of wss.clients) {
      ws.terminate();
    }
    wss.close();
    await new Promise((resolve) => httpServer.close(resolve));
  });

  const nextConnection = () =>
    new Promise<Connection>((resolve) => {
      host.on('connection', resolve);
    });

  const open = (path: string) => {
    const ws = new WebSocket(`${base}${path}`);
    clients.push(ws);
    return ws;
  };

  it('accepts upgrades on /room/<code>', async () => {
    const accepted = nextConnection();
    const ws = open('/room/default');

    const connection = await accepted;
    await new Promise((resolve) => ws.once('open', resolve));
    expect(connection.id).toBeTruthy();
    expect(host.size).toBe(1);
  });

  it.each(['/', '/socket.io/', '/room/', '/room/bad code', '/room/a/b'])(
    'refuses upgrades on %s',
    async (path) => {
      const ws = open(path);

      const status = await new Promise<number | undefined>((resolve) => {
        ws.once('unexpected-response', (_request, response) =>
          resolve(response.statusCode)
        );
        ws.once('error', () => resolve(undefined));
      });
      expect(status).toBe(404);
      expect(host.size).toBe(0);
    }
  );

  it('drops a client that sends no heartbeat', async () => {
    const accepted = nextConnection();
    const ws = open('/room/default');
    const closed = new Promise<number>((resolve) =>
      ws.once('close', (code) => resolve(code))
    );
    const connection = await accepted;
    const disconnected = vi.fn();
    connection.on('disconnect', disconnected);

    expect(await closed).toBe(4000);
    expect(disconnected).toHaveBeenCalledOnce();
    expect(host.size).toBe(0);
  });

  it('keeps a realtime client that pings', async () => {
    const client = createRealtimeClient(`${base}/room/default`, {
      reconnect: false,
      pingIntervalMs: IDLE_MS / 4,
    });
    clients.push({ close: () => client.disconnect() });
    const onDisconnect = vi.fn();
    client.on('disconnect', onDisconnect);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    await new Promise((resolve) => setTimeout(resolve, IDLE_MS * 4));
    expect(onDisconnect).not.toHaveBeenCalled();
    expect(client.connected).toBe(true);
    expect(host.size).toBe(1);
  });

  it('enforces the host frame limit as the ws maxPayload', async () => {
    expect(wss.options.maxPayload).toBe(host.maxFrameBytes);
    const ws = open('/room/default');
    await new Promise((resolve) => ws.once('open', resolve));
    const closed = new Promise<number>((resolve) =>
      ws.once('close', (code) => resolve(code))
    );

    ws.send('x'.repeat(2048));

    expect(await closed).toBe(1009);
  });

  it('round-trips an ack with the realtime client', async () => {
    host.on('connection', (connection) => {
      connection.on('agent:get-state', (reply) =>
        reply({
          phase: 'LOBBY',
          players: [],
          self: { type: 'waiting', name: '', socketId: connection.id },
        })
      );
    });
    const client = createRealtimeClient(`${base}/room/default`, {
      reconnect: false,
    });
    clients.push({ close: () => client.disconnect() });

    // Emitted before the connection opens: queued, then answered
    const snapshot = await new Promise<PlayerGameSnapshot>((resolve) => {
      client.emit('agent:get-state', resolve);
    });
    expect(snapshot.phase).toBe('LOBBY');
    expect(snapshot.self.socketId).toBeTruthy();
  });
});
