import type {components} from '../generated/api';
import {joinNames, LOCALES, type Locale, type Messages} from '../i18n/catalog';

// What the admin writes in a form: a text per language of the
// organization.
export type Draft = Partial<Record<Locale, string>>;

// A field the organization writes in each of its languages names the
// language once there is more than one.
export function fieldLabel(
  label: string,
  locale: Locale,
  locales: readonly Locale[],
  t: Messages,
): string {
  return locales.length > 1
    ? t.admin.localized.label(label, t.language.names[locale])
    : label;
}

// Trimmed, in the organization's languages and no others, as the server
// wants it.
export function trimmedText(draft: Draft, locales: readonly Locale[]): Draft {
  return Object.fromEntries(
    locales.map((locale) => [locale, (draft[locale] ?? '').trim()]),
  );
}

// The organization's languages the text is not yet written in, named for
// a sentence, or null when it is in all of them. Text that is empty in
// every language lacks nothing.
export function missingLanguages(
  text: Partial<Record<Locale, string | string[]>>,
  locales: readonly Locale[],
  t: Messages,
): string | null {
  const written = (locale: Locale) => (text[locale]?.length ?? 0) > 0;

  if (!LOCALES.some(written)) {
    return null;
  }

  const missing = locales.filter((locale) => !written(locale));

  return missing.length === 0
    ? null
    : missing.map((locale) => t.language.names[locale]).join(', ');
}

// Tags are written as a list separated by commas.
export function tagsOf(text: string): string[] {
  return text
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

// What the bar on every admin page says while some of the organization's
// text lacks a language, or null when nothing does.
export function untranslatedMessage(
  untranslated: components['schemas']['Untranslated'],
  t: Messages,
): string | null {
  if (untranslated === null) {
    return null;
  }

  const {locales, kinds, resources, announcements, rules} = untranslated;
  const what = [
    resources > 0 ? t.admin.localized.resources(resources) : null,
    kinds > 0 ? t.admin.localized.kinds(kinds) : null,
    announcements > 0 ? t.admin.localized.announcements(announcements) : null,
    rules ? t.admin.localized.rules : null,
  ].filter((part) => part !== null);

  return t.admin.localized.missing(
    joinNames(
      locales.map((locale) => t.language.names[locale]),
      t,
    ),
    joinNames(what, t),
  );
}
