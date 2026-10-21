import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'loup-garou-session-token';

// expo-secure-store has no web implementation; fall back to localStorage
// so joining from a browser doesn't throw mid-join and strand the player.
const isWeb = Platform.OS === 'web';

/**
 * The persisted session token that lets a player rejoin their seat after a
 * reconnect or an app restart. Code that is unit-tested takes it as a
 * `SessionTokens` parameter, so tests can pass an in-memory stand-in.
 */
export const sessionTokens = {
  get() {
    if (isWeb) {
      return Promise.resolve(localStorage.getItem(SESSION_TOKEN_KEY));
    }

    return getItemAsync(SESSION_TOKEN_KEY);
  },

  save(token: string) {
    if (isWeb) {
      localStorage.setItem(SESSION_TOKEN_KEY, token);

      return Promise.resolve();
    }

    return setItemAsync(SESSION_TOKEN_KEY, token);
  },

  clear() {
    if (isWeb) {
      localStorage.removeItem(SESSION_TOKEN_KEY);

      return Promise.resolve();
    }

    return deleteItemAsync(SESSION_TOKEN_KEY);
  },
};

export type SessionTokens = typeof sessionTokens;
