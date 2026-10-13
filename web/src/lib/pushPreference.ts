// Whether the apartment wants push in this browser. On until turned off
// under Lägenhet: the subscription is then not sent at start, and is
// dropped. A failing storage means on, the default.
const KEY = 'push-enabled';

export async function readPushEnabled(): Promise<boolean> {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export async function savePushEnabled(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(KEY, enabled ? 'on' : 'off');
  } catch {
    // Asked again next time.
  }
}
