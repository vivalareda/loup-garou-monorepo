import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';

const SESSION_TOKEN_KEY = 'loup-garou-session-token';

export function getSessionToken() {
  return getItemAsync(SESSION_TOKEN_KEY);
}

export function saveSessionToken(token: string) {
  return setItemAsync(SESSION_TOKEN_KEY, token);
}

export function clearSessionToken() {
  return deleteItemAsync(SESSION_TOKEN_KEY);
}
