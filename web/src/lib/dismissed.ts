// The announcements an apartment has hidden on this device. Only a
// convenience, so a failing storage shows them again rather than breaking.
const KEY = 'dismissed-announcements';
const KEEP = 20;

export async function readDismissed(): Promise<string[]> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(stored)
      ? stored.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}

// The caller passes the whole list, so two quick hides cannot overwrite
// each other.
export async function saveDismissed(keys: string[]): Promise<void> {
  try {
    localStorage.setItem(KEY, JSON.stringify(keys.slice(0, KEEP)));
  } catch {
    // Private mode or blocked storage: it shows again next time.
  }
}
