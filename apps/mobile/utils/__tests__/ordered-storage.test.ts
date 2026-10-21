import { describe, expect, it } from 'vitest';
import {
  createOrderedStorage,
  type KeyValueStorage,
} from '@/utils/ordered-storage';

/** A store whose writes finish only when the test says so; reads are instant. */
function createSlowWriteStorage() {
  const values = new Map<string, string>();
  const pendingWrites: (() => void)[] = [];

  const later = (apply: () => void) =>
    new Promise<void>((resolve) => {
      pendingWrites.push(() => {
        apply();
        resolve();
      });
    });

  const storage: KeyValueStorage = {
    getItem: (key) => Promise.resolve(values.get(key) ?? null),
    setItem: (key, value) => later(() => values.set(key, value)),
    removeItem: (key) => later(() => values.delete(key)),
  };

  return {
    storage,
    /** Finishes the oldest write still in flight. */
    finishWrite: () => pendingWrites.shift()?.(),
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('ordered storage', () => {
  it('a read waits for the writes called before it', async () => {
    const { storage, finishWrite } = createSlowWriteStorage();
    const sessionToken = createOrderedStorage(storage)('session-token');
    const saved = sessionToken.save('room-a-token');
    await flush();
    finishWrite();
    await saved;

    // A room change clears the token, and the new connection reads it
    // before the (slow) delete has finished
    const cleared = sessionToken.clear();
    const read = sessionToken.get();
    await flush();
    finishWrite();
    await cleared;

    expect(await read).toBeNull();
  });

  it('a failed call does not block the ones after it', async () => {
    const { storage } = createSlowWriteStorage();

    const sessionToken = createOrderedStorage({
      ...storage,
      setItem: () => Promise.reject(new Error('locked keychain')),
    })('session-token');

    await expect(sessionToken.save('token')).rejects.toThrow('locked keychain');
    expect(await sessionToken.get()).toBeNull();
  });
});
