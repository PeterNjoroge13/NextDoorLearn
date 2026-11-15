import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The Expo push token this device registered for the signed-in account. Kept so sign-out
// can unregister it; otherwise a shared phone keeps receiving the previous user's notifications.
const PUSH_TOKEN_KEY = 'nextdoorlearn.pushToken.v1';
const UNREGISTER_TIMEOUT_MS = 5000;

const nativeStorage = Platform.OS !== 'web';

export const pushTokenStorage = {
  get: async (): Promise<string | null> => (nativeStorage ? SecureStore.getItemAsync(PUSH_TOKEN_KEY) : null),
  set: async (token: string): Promise<void> => {
    if (nativeStorage) await SecureStore.setItemAsync(PUSH_TOKEN_KEY, token);
  },
  remove: async (): Promise<void> => {
    if (nativeStorage) await SecureStore.deleteItemAsync(PUSH_TOKEN_KEY);
  },
};

// Best effort: never throws and never waits longer than a few seconds, so sign-out always finishes.
export const unregisterStoredPushToken = async (unregister: (token: string) => Promise<unknown>) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const token = await pushTokenStorage.get();
    if (!token) return;
    await Promise.race([
      unregister(token),
      new Promise((resolve) => { timer = setTimeout(resolve, UNREGISTER_TIMEOUT_MS); }),
    ]);
  } catch {
    // Sign-out must still complete. The server also moves the token to whoever registers it next.
  } finally {
    if (timer) clearTimeout(timer);
    await pushTokenStorage.remove().catch(() => undefined);
  }
};
