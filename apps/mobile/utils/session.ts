import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  createOrderedStorage,
  type KeyValueStorage,
  type StoredString,
} from '@/utils/ordered-storage';

// expo-secure-store has no web implementation; fall back to localStorage
// so joining from a browser doesn't throw mid-join and strand the player.
const webStorage: KeyValueStorage = {
  getItem: (key) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key, value) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key) => Promise.resolve(localStorage.removeItem(key)),
};

const secureStorage: KeyValueStorage = {
  getItem: getItemAsync,
  setItem: setItemAsync,
  removeItem: deleteItemAsync,
};

const stored = createOrderedStorage(
  Platform.OS === 'web' ? webStorage : secureStorage
);

/**
 * The persisted session token that lets a player rejoin their seat after a
 * reconnect or an app restart. Code that is unit-tested takes it as a
 * `SessionTokens` parameter, so tests can pass an in-memory stand-in.
 */
export const sessionTokens = stored('loup-garou-session-token');

/** The room the session token belongs to, so a relaunch rejoins there. */
export const sessionRoom = stored('loup-garou-room-code');

export type SessionTokens = StoredString;
