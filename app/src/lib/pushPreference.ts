import * as SecureStore from 'expo-secure-store';

// Whether the apartment wants push on this device. On until turned off
// under Lägenhet: the device is then not registered at start, and its
// token is dropped. A failing storage means on, the default.
const KEY = 'push-enabled';

export async function readPushEnabled(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function savePushEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, enabled ? 'on' : 'off');
  } catch {
    // Asked again next time.
  }
}
