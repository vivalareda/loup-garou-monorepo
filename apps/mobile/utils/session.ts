import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation; fall back to localStorage
// so joining from a browser doesn't throw mid-join and strand the player.
const isWeb = Platform.OS === 'web';

/** One string kept across app launches. */
function storedString(key: string) {
  return {
    get(): Promise<string | null> {
      return isWeb
        ? Promise.resolve(localStorage.getItem(key))
        : getItemAsync(key);
    },
    save(value: string): Promise<void> {
      if (isWeb) {
        localStorage.setItem(key, value);
        return Promise.resolve();
      }
      return setItemAsync(key, value);
    },
    clear(): Promise<void> {
      if (isWeb) {
        localStorage.removeItem(key);
        return Promise.resolve();
      }
      return deleteItemAsync(key);
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
