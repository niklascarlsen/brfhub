import {z} from 'zod';

import {localeSchema} from '../lib/locale.js';

// The languages the organization writes in. The clients show only these,
// so its own text is never in another language than the rest.
const localesSchema = localeSchema.array();

// What the account books for, when it is a resident's.
const memberAccountSchema = z.object({
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

// What the account manages, when it is an admin's.
const adminAccountSchema = z.object({
  untranslated: untranslatedSchema,
});

// Who signed in: a resident, an admin, or someone who is both.
export const accountSchema = z.object({
  organizationName: z.string(),
  locales: localesSchema,
  member: memberAccountSchema.nullable(),
  admin: adminAccountSchema.nullable(),
});

export type Account = z.infer<typeof accountSchema>;
export type Untranslated = z.infer<typeof untranslatedSchema>;

z.globalRegistry.add(memberAccountSchema, {id: 'MemberAccount'});
z.globalRegistry.add(untranslatedSchema, {id: 'Untranslated'});
z.globalRegistry.add(adminAccountSchema, {id: 'AdminAccount'});
z.globalRegistry.add(accountSchema, {id: 'Account'});
