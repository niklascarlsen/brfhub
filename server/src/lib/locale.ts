import {z} from 'zod';

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

z.globalRegistry.add(localeSchema, {id: 'Locale'});
