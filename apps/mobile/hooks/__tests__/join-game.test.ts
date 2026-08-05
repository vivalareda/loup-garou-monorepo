import { beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;
const listeners = new Map<string, Handler[]>();

vi.mock('@/utils/sockets', () => ({
  socket: {
    on: vi.fn((event: string, handler: Handler) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    }),
    off: vi.fn((event: string, handler: Handler) => {
      listeners.set(
        event,
        (listeners.get(event) ?? []).filter((h) => h !== handler)
      );
    }),
    emit: vi.fn(),
  },
}));

const fire = (event: string, ...args: unknown[]) => {
  for (const handler of listeners.get(event) ?? []) {
    handler(...args);
  }
};

describe('submitJoin', () => {
  beforeEach(async () => {
    listeners.clear();
    const { socket } = await import('@/utils/sockets');
    vi.mocked(socket.emit).mockClear();
  });

  it('trims the name and emits player:join', async () => {
    const { submitJoin } = await import('@/hooks/use-join-game');
    const { socket } = await import('@/utils/sockets');

    expect(submitJoin('  Alice  ')).toBe(true);
    expect(socket.emit).toHaveBeenCalledExactlyOnceWith('player:join', 'Alice');
  });

  it('emits nothing for an empty or whitespace-only name', async () => {
    const { submitJoin } = await import('@/hooks/use-join-game');
    const { socket } = await import('@/utils/sockets');

    expect(submitJoin('')).toBe(false);
    expect(submitJoin('   ')).toBe(false);
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('registerJoinListeners', () => {
  beforeEach(() => {
    listeners.clear();
  });

  it('routes success to onJoined and rejection to a translated onRejected', async () => {
    const { registerJoinListeners } = await import('@/hooks/use-join-game');
    const onJoined = vi.fn();
    const onRejected = vi.fn();

    registerJoinListeners({ onJoined, onRejected });

    const playerData = {
      type: 'waiting',
      name: 'Alice',
      socketId: 'alice-sid',
      sessionToken: 'token-1',
    };
    fire('lobby:player-data', playerData);
    fire('lobby:join-rejected', 'Game is full');

    expect(onJoined).toHaveBeenCalledExactlyOnceWith(playerData);
    expect(onRejected).toHaveBeenCalledExactlyOnceWith(
      'La partie est complète.'
    );
  });

  it('falls back to a generic message for unknown rejection reasons', async () => {
    const { registerJoinListeners } = await import('@/hooks/use-join-game');
    const onRejected = vi.fn();

    registerJoinListeners({ onJoined: vi.fn(), onRejected });
    fire('lobby:join-rejected', 'Something exotic');

    expect(onRejected).toHaveBeenCalledExactlyOnceWith(
      'Impossible de rejoindre la partie.'
    );
  });

  it('cleanup removes both listeners so retries never stack handlers', async () => {
    const { registerJoinListeners } = await import('@/hooks/use-join-game');
    const onJoined = vi.fn();
    const onRejected = vi.fn();

    const cleanup = registerJoinListeners({ onJoined, onRejected });
    cleanup();

    fire('lobby:player-data', { type: 'waiting', name: 'A', socketId: 's' });
    fire('lobby:join-rejected', 'Game is full');

    expect(onJoined).not.toHaveBeenCalled();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it('registering twice does not double-deliver after one cleanup', async () => {
    const { registerJoinListeners } = await import('@/hooks/use-join-game');
    const first = vi.fn();
    const second = vi.fn();

    const cleanupFirst = registerJoinListeners({
      onJoined: first,
      onRejected: vi.fn(),
    });
    registerJoinListeners({ onJoined: second, onRejected: vi.fn() });
    cleanupFirst();

    fire('lobby:player-data', { type: 'waiting', name: 'A', socketId: 's' });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
