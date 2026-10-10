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

const adminAccountSchema = z.object({
  role: z.literal('admin'),
  organizationName: z.string(),
  locales: localesSchema,
});

export const accountSchema = z.discriminatedUnion('role', [
  memberAccountSchema,
  adminAccountSchema,
]);

export type Account = z.infer<typeof accountSchema>;

z.globalRegistry.add(memberAccountSchema, {id: 'MemberAccount'});
z.globalRegistry.add(adminAccountSchema, {id: 'AdminAccount'});
z.globalRegistry.add(accountSchema, {id: 'Account'});
