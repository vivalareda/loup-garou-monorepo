/** A key-value store kept across app launches (SecureStore, localStorage). */
export type KeyValueStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/** One string kept across app launches. */
export type StoredString = {
  get: () => Promise<string | null>;
  save: (value: string) => Promise<void>;
  clear: () => Promise<void>;
};

/**
 * Wraps `storage` so every call on any of its keys (reads too) runs after
 * the ones before it, in call order: a room change clears the session
 * token right before the new room's connection reads it, and that read
 * must see the clear. Returns a factory for one key's `StoredString`.
 */
export function createOrderedStorage(storage: KeyValueStorage) {
  let pending: Promise<void> = Promise.resolve();

  function inOrder<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(operation);

    // A failed call must not block the ones after it
    pending = result.then(
      () => undefined,
      () => undefined
    );

    return result;
  }

  return (key: string): StoredString => ({
    get: () => inOrder(() => storage.getItem(key)),
    save: (value) => inOrder(() => storage.setItem(key, value)),
    clear: () => inOrder(() => storage.removeItem(key)),
  });
}
