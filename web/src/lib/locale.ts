import {isLocaleChoice, type LocaleChoice} from '@/i18n/catalog';

// The language picked in this browser. Read before the first render, so the
// page never shows in one language and then switches. A failing storage
// only means the browser's own language is used.
const KEY = 'locale';

export function readLocaleChoice(): LocaleChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return isLocaleChoice(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveLocaleChoice(choice: LocaleChoice): void {
  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Private mode or blocked storage: the browser's language is used next
    // time.
  }
}
