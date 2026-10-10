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

// "A, B och C". Intl.ListFormat is missing on Hermes, so it is spelled out.
export function joinNames(names: readonly string[], t: Messages): string {
  if (names.length < 2) {
    return names.join('');
  }

  return t.rules.joinList(
    names.slice(0, -1).join(', '),
    names[names.length - 1] ?? '',
  );
}

// What the person picked: a language, or whatever the device uses.
export type LocaleChoice = Locale | 'system';

function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

export function isLocaleChoice(value: unknown): value is LocaleChoice {
  return value === 'system' || (typeof value === 'string' && isLocale(value));
}

// What the person picked when the organization writes in it, else the
// first of the device's languages, in its order, that the organization
// writes in, else English when it does, else the organization's own
// language. Before sign-in every language the app speaks is open. The
// server picks its text the same way.
export function resolveLocale(
  choice: LocaleChoice,
  deviceLanguages: readonly string[],
  available: readonly Locale[] = LOCALES,
): Locale {
  if (choice !== 'system' && available.includes(choice)) {
    return choice;
  }

  for (const tag of deviceLanguages) {
    const [language] = tag.split('-');
    const known = available.find((locale) => locale === language);

    if (known) {
      return known;
    }
  }

  return available.includes('en') ? 'en' : (available[0] ?? 'en');
}

// The text in the language shown, else in another one it is written in,
// for text written before the organization took up the language.
export function localize<T>(
  text: Partial<Record<Locale, T>>,
  locale: Locale,
): T | undefined {
  for (const candidate of [locale, ...LOCALES]) {
    const value = text[candidate];

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}
