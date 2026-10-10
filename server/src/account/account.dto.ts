import {z} from 'zod';

import {localeSchema} from '../lib/locale.js';

// The languages the organization writes in. The clients show only these,
// so its own text is never in another language than the rest.
const localesSchema = localeSchema.array();

const memberAccountSchema = z.object({
  role: z.literal('member'),
  organizationName: z.string(),
  locales: localesSchema,
  apartment: z.string(),
});

// The organization's own text that is written in some of its languages but
// not all of them, counted where the admin writes it. Null when nothing is
// missing. Only what apartments can still see counts: resources not yet
// closed and announcements not yet ended.
const untranslatedSchema = z
  .object({
    // The languages something lacks, in the order of LOCALES.
    locales: localeSchema.array(),
    kinds: z.number().int(),
    resources: z.number().int(),
    announcements: z.number().int(),
    rules: z.boolean(),
  })
  .nullable();

const adminAccountSchema = z.object({
  role: z.literal('admin'),
  organizationName: z.string(),
  locales: localesSchema,
  untranslated: untranslatedSchema,
});

export const accountSchema = z.discriminatedUnion('role', [
  memberAccountSchema,
  adminAccountSchema,
]);

export type Account = z.infer<typeof accountSchema>;
export type Untranslated = z.infer<typeof untranslatedSchema>;

z.globalRegistry.add(memberAccountSchema, {id: 'MemberAccount'});
z.globalRegistry.add(untranslatedSchema, {id: 'Untranslated'});
z.globalRegistry.add(adminAccountSchema, {id: 'AdminAccount'});
z.globalRegistry.add(accountSchema, {id: 'Account'});
