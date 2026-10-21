import type { AddressInfo } from 'node:net';
import { createRoom, roomExists } from '@repo/realtime';
import { DEFAULT_ROOM_CODE } from '@repo/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { httpServer } from '@/server/http-server';

describe('the Node room API (a single game)', () => {
  let base: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    // SAFETY: a server listening on a TCP port reports an AddressInfo,
    // never the string a pipe or socket path would give
    const { port } = httpServer.address() as AddressInfo;
    base = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => httpServer.close(resolve));
  });

  it('creates the one room it hosts', async () => {
    expect(await createRoom(base)).toBe(DEFAULT_ROOM_CODE);
  });

  it('finds every room code, since they all reach the one game', async () => {
    expect(await roomExists(base, 'ANYCODE2')).toBe(true);
  });

  it('still answers health checks', async () => {
    const response = await fetch(base);
    expect(await response.text()).toBe('ok');
  });
});
