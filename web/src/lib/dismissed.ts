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

export async function dismiss(id: string): Promise<void> {
  const ids = [id, ...(await readDismissed())].slice(0, KEEP);

  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode or blocked storage: it shows again next time.
  }
}
