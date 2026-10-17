import {sql, type SQL} from 'drizzle-orm';
import type {PgColumn} from 'drizzle-orm/pg-core';
import {z} from 'zod';

import {appError} from './errors.js';
import {optionalTextSchema, textSchema, type TextOptions} from './text.js';

// The languages the clients are written in. A device picks one and the
// server writes what it sends that device, such as push, in it.
export const LOCALES = ['sv', 'en'] as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;

// How dates are written in each language.
export const INTL_LOCALES: Record<Locale, string> = {
  sv: 'sv-SE',
  en: 'en-GB',
};

// The languages an organization writes in, each once and in the order of
// LOCALES, so two lists of the same languages compare equal.
export const organizationLocalesSchema = localeSchema
  .array()
  .min(1)
  .transform((locales) => LOCALES.filter((locale) => locales.includes(locale)));

// The language a device asks for, when the organization writes in it.
export function requestedLocale(
  requested: readonly string[],
  available: readonly Locale[],
): Locale | null {
  for (const tag of requested) {
    const [language] = tag.trim().split(/[-;]/);
    const known = available.find((locale) => locale === language);

    if (known) {
      return known;
    }
  }

  return null;
}

// The language a device asks for when the organization writes in it, else
// English when it does, else the organization's own language. The clients
// pick their language the same way.
export function resolveLocale(
  requested: readonly string[],
  available: readonly Locale[],
): Locale {
  return (
    requestedLocale(requested, available) ??
    (available.includes('en') ? 'en' : (available[0] ?? 'en'))
  );
}

// The language mail to an account is written in, outside any request: the
// one its device last showed while the organization still writes in it,
// else the organization's first.
export function accountLocale(
  last: string | null,
  available: readonly Locale[],
): Locale {
  return available.find((locale) => locale === last) ?? available[0] ?? 'sv';
}

// The Accept-Language header, read in its own order: the clients send one
// language, and a browser lists its own most wanted first.
export function requestedLocales(header: string | undefined): string[] {
  return header?.split(',') ?? [];
}

// A value per language, each one optional. Written out rather than a
// record, so the clients get the languages as known keys.
export function perLocale<T extends z.ZodType>(value: T) {
  const shape = {
    sv: value.optional(),
    en: value.optional(),
  } satisfies Record<Locale, z.ZodOptional<T>>;

  return z.object(shape);
}

// Text the organization writes, once per language it uses. A language the
// organization stops using keeps its text until the text is saved again,
// so turning the language back on brings back what was not changed.
export const localizedTextSchema = perLocale(z.string());

export type LocalizedText = z.infer<typeof localizedTextSchema>;

// The tags of a resource, a list per language. The lists need not be as
// long as each other.
export const localizedTagsSchema = perLocale(z.string().array());

export type LocalizedTags = z.infer<typeof localizedTagsSchema>;

// What the admin sends: text that must be there in every language the
// organization uses, and nothing in any other.
export function localizedInputSchema(maxLength: number, options?: TextOptions) {
  return perLocale(textSchema(maxLength, options));
}

// The same for text that may be left out, in every language at once.
export function optionalLocalizedInputSchema(
  maxLength: number,
  options?: TextOptions,
) {
  return perLocale(optionalTextSchema(maxLength, options));
}

function hasValue(value: string | string[] | undefined): boolean {
  return value !== undefined && value.length > 0;
}

// Throws unless the text is written in exactly the organization's
// languages. With optional, it may instead be empty in all of them.
export function assertTranslated<T extends string | string[]>(
  text: Partial<Record<Locale, T>>,
  locales: readonly Locale[],
  {optional = false} = {},
): Partial<Record<Locale, T>> {
  const written = LOCALES.filter((locale) => hasValue(text[locale]));

  if (optional && written.length === 0) {
    return {};
  }

  if (
    written.length !== locales.length ||
    written.some((locale) => !locales.includes(locale))
  ) {
    throw appError('LANGUAGES_CHANGED');
  }

  return Object.fromEntries(written.map((locale) => [locale, text[locale]]));
}

// The text in the language asked for, else in another one it has.
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

type Json = PgColumn | SQL;

function inOrder(locale: Locale): Locale[] {
  return [locale, ...LOCALES.filter((other) => other !== locale)];
}

// localize for a jsonb column, so a query hands back plain text.
export function localized(column: Json, locale: Locale): SQL<string> {
  const candidates = inOrder(locale).map(
    (candidate) => sql`${column} ->> ${candidate}::text`,
  );

  return sql<string>`coalesce(${sql.join(candidates, sql`, `)}, '')`;
}

// localize for a jsonb column of tag lists, as a text array.
export function localizedTags(column: Json, locale: Locale): SQL<string[]> {
  const candidates = inOrder(locale).map(
    (candidate) => sql`${column} -> ${candidate}::text`,
  );

  return sql<string[]>`array(
    select tag.value from jsonb_array_elements_text(
      coalesce(${sql.join(candidates, sql`, `)}, '[]'::jsonb)
    ) with ordinality as tag(value, position)
    order by tag.position
  )`;
}

z.globalRegistry.add(localeSchema, {id: 'Locale'});
z.globalRegistry.add(localizedTextSchema, {id: 'LocalizedText'});
z.globalRegistry.add(localizedTagsSchema, {id: 'LocalizedTags'});
