import type {components} from '@/generated/api';
import {en} from '@/i18n/en';
import {sv} from '@/i18n/sv';

// The app was written in Swedish, so its messages give the shape every
// other language fills in.
export type Messages = typeof sv;

// The languages the server knows, so a device can tell it which one to
// write its push in.
export type Locale = components['schemas']['Locale'];

export const CATALOGS: Record<Locale, Messages> = {sv, en};

export const LOCALES = Object.keys(CATALOGS) as Locale[];

// What the person picked: a language, or whatever the device uses.
export type LocaleChoice = Locale | 'system';

function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

export function isLocaleChoice(value: unknown): value is LocaleChoice {
  return value === 'system' || (typeof value === 'string' && isLocale(value));
}

// The first of the device's languages, in its order, that the app speaks,
// and English when it speaks none of them.
export function resolveLocale(
  choice: LocaleChoice,
  deviceLanguages: readonly string[],
): Locale {
  if (choice !== 'system') {
    return choice;
  }

  for (const tag of deviceLanguages) {
    const [language] = tag.split('-');

    if (isLocale(language)) {
      return language;
    }
  }

  return 'en';
}
