import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation; fall back to localStorage
// so joining from a browser doesn't throw mid-join and strand the player.
const isWeb = Platform.OS === 'web';

/**
 * Every storage call (reads too) runs after the ones before it, in call
 * order: a room change clears the token right before the new room's
 * connection reads it, and that read must see the clear.
 */
let pending: Promise<unknown> = Promise.resolve();
function inOrder<T>(operation: () => Promise<T>): Promise<T> {
  const result = pending.then(operation);
  // A failed call must not block the ones after it
  pending = result.catch(() => null);
  return result;
}

/** One string kept across app launches. */
function storedString(key: string) {
  return {
    get(): Promise<string | null> {
      return inOrder(async () =>
        isWeb ? localStorage.getItem(key) : await getItemAsync(key)
      );
    },
    save(value: string): Promise<void> {
      return inOrder(async () => {
        if (isWeb) {
          localStorage.setItem(key, value);
          return;
        }
        await setItemAsync(key, value);
      });
    },
    clear(): Promise<void> {
      return inOrder(async () => {
        if (isWeb) {
          localStorage.removeItem(key);
          return;
        }
        await deleteItemAsync(key);
      });
    },
  };
}

const sessionToken = storedString('loup-garou-session-token');
/** The room the session token belongs to, so a relaunch rejoins there. */
const sessionRoom = storedString('loup-garou-room-code');

export const getSessionToken = () => sessionToken.get();
export const saveSessionToken = (token: string) => sessionToken.save(token);
export const clearSessionToken = () => sessionToken.clear();

export const getSessionRoom = () => sessionRoom.get();
export const saveSessionRoom = (code: string) => sessionRoom.save(code);
