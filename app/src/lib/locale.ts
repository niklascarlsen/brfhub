import * as SecureStore from 'expo-secure-store';

import {isLocaleChoice, type LocaleChoice} from '@/i18n/catalog';

// The language picked on this device. Read before the first render, so the
// app never shows in one language and then switches. A failing storage
// only means the device's own language is used.
const KEY = 'locale';

export function readLocaleChoice(): LocaleChoice {
  try {
    const stored = SecureStore.getItem(KEY);
    return isLocaleChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveLocaleChoice(choice: LocaleChoice): void {
  try {
    SecureStore.setItem(KEY, choice);
  } catch {
    // The device's language is used next time.
  }
}
