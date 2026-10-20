import { describe, expect, it, vi } from 'vitest';

/** SecureStore whose writes finish only when the test says so. */
const store = new Map<string, string>();
const pendingWrites: (() => void)[] = [];
const later = (apply: () => void) =>
  new Promise<void>((resolve) => {
    pendingWrites.push(() => {
      apply();
      resolve();
    });
  });

vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: (key: string, value: string) =>
    later(() => store.set(key, value)),
  deleteItemAsync: (key: string) => later(() => store.delete(key)),
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('session storage', () => {
  it('a read waits for the writes called before it', async () => {
    const { clearSessionToken, getSessionToken, saveSessionToken } =
      await import('@/utils/session');
    const saved = saveSessionToken('room-a-token');
    await flush();
    pendingWrites.shift()?.();
    await saved;

    // A room change clears the token, and the new connection reads it
    // before the (slow) delete has finished
    const cleared = clearSessionToken();
    const read = getSessionToken();
    await flush();
    pendingWrites.shift()?.();
    await cleared;

    expect(await read).toBeNull();
  });
});
