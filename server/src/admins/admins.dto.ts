import {z} from 'zod';

const nameSchema = z.string().trim().min(1).max(100);
// Trimmed and lower-cased before it is checked, as people type it.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const adminUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  // The apartment the admin also lives in, when they do.
  apartment: z.string().nullable(),
  twoFactorEnabled: z.boolean(),
  lastSignInOn: z.iso.date().nullable(),
  // The admin asking.
  self: z.boolean(),
});

export const addAdminBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
});

export const adminParamsSchema = z.object({
  id: z.string().min(1),
});

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AddAdminBody = z.infer<typeof addAdminBodySchema>;

z.globalRegistry.add(adminUserSchema, {id: 'AdminUser'});
z.globalRegistry.add(addAdminBodySchema, {id: 'AddAdminBody'});
