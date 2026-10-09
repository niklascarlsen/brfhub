import * as SecureStore from 'expo-secure-store';

// The announcements an apartment has hidden on this device. Only a
// convenience, so a failing storage shows them again rather than breaking.
// Older iOS refuses values over about 2 KB, hence the short list.
const KEY = 'dismissed-announcements';
const KEEP = 20;

export async function readDismissed(): Promise<string[]> {
  try {
    const stored: unknown = JSON.parse(
      (await SecureStore.getItemAsync(KEY)) ?? '[]',
    );
    return Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function dismiss(id: string): Promise<void> {
  const ids = [id, ...(await readDismissed())].slice(0, KEEP);

  try {
    await SecureStore.setItemAsync(KEY, JSON.stringify(ids));
  } catch {
    // It shows again next time.
  }
}
