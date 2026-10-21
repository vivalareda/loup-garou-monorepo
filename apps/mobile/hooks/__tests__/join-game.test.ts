import type { Player } from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerJoinListeners, submitJoin } from '@/hooks/use-join-game';
import { createFakeGameServer, type FakeGameServer } from './fake-game-server';

let server: FakeGameServer;

beforeEach(() => {
  server = createFakeGameServer();
  server.connect();
});

describe('submitJoin', () => {
  it('trims the name and emits player:join', () => {
    expect(submitJoin(server.socket, '  Alice  ')).toBe(true);
    expect(server.emitted()).toEqual([
      { event: 'player:join', args: ['Alice'] },
    ]);
  });

  it('emits nothing for an empty or whitespace-only name', () => {
    expect(submitJoin(server.socket, '')).toBe(false);
    expect(submitJoin(server.socket, '   ')).toBe(false);
    expect(server.emitted()).toEqual([]);
  });
});

describe('registerJoinListeners', () => {
  it('routes success to onJoined and rejection to a translated onRejected', () => {
    const onJoined = vi.fn();
    const onRejected = vi.fn();

    registerJoinListeners(server.socket, { onJoined, onRejected });

    const playerData = {
      type: 'waiting',
      name: 'Alice',
      socketId: 'alice-sid',
      sessionToken: 'token-1',
    } satisfies Player;

    server.send('lobby:player-data', playerData);
    server.send('lobby:join-rejected', 'Game is full');

    expect(onJoined).toHaveBeenCalledExactlyOnceWith(playerData);
    expect(onRejected).toHaveBeenCalledExactlyOnceWith(
      'La partie est complète.'
    );
  });

  it('falls back to a generic message for unknown rejection reasons', () => {
    const onRejected = vi.fn();

    registerJoinListeners(server.socket, { onJoined: vi.fn(), onRejected });
    server.send('lobby:join-rejected', 'Something exotic');

    expect(onRejected).toHaveBeenCalledExactlyOnceWith(
      'Impossible de rejoindre la partie.'
    );
  });

  it('cleanup removes both listeners so retries never stack handlers', () => {
    const onJoined = vi.fn();
    const onRejected = vi.fn();

    const cleanup = registerJoinListeners(server.socket, {
      onJoined,
      onRejected,
    });

    cleanup();

    server.send('lobby:player-data', {
      type: 'waiting',
      name: 'A',
      socketId: 's',
    });
    server.send('lobby:join-rejected', 'Game is full');

    expect(onJoined).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('registering twice does not double-deliver after one cleanup', () => {
    const first = vi.fn();
    const second = vi.fn();

    const cleanupFirst = registerJoinListeners(server.socket, {
      onJoined: first,
      onRejected: vi.fn(),
    });

    registerJoinListeners(server.socket, {
      onJoined: second,
      onRejected: vi.fn(),
    });
    cleanupFirst();

    server.send('lobby:player-data', {
      type: 'waiting',
      name: 'A',
      socketId: 's',
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
