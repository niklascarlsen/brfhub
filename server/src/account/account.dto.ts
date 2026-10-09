import {z} from 'zod';

const memberAccountSchema = z.object({
  role: z.literal('member'),
  organizationName: z.string(),
  apartment: z.string(),
});

const adminAccountSchema = z.object({
  role: z.literal('admin'),
  organizationName: z.string(),
});

export const accountSchema = z.discriminatedUnion('role', [
  memberAccountSchema,
  adminAccountSchema,
]);

export type Account = z.infer<typeof accountSchema>;

z.globalRegistry.add(memberAccountSchema, {id: 'MemberAccount'});
z.globalRegistry.add(adminAccountSchema, {id: 'AdminAccount'});
z.globalRegistry.add(accountSchema, {id: 'Account'});
