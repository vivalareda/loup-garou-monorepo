import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';

const SESSION_TOKEN_KEY = 'loup-garou-session-token';

// expo-secure-store has no web implementation; fall back to localStorage
// so joining from a browser doesn't throw mid-join and strand the player.
const isWeb = Platform.OS === 'web';

export function getSessionToken() {
  if (isWeb) {
    return Promise.resolve(localStorage.getItem(SESSION_TOKEN_KEY));
  }
  return getItemAsync(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string) {
  if (isWeb) {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    return Promise.resolve();
  }
  return setItemAsync(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  if (isWeb) {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    return Promise.resolve();
  }
  return deleteItemAsync(SESSION_TOKEN_KEY);
}
