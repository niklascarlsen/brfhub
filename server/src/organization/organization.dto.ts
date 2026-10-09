import {z} from 'zod';

export const organizationSettingsSchema = z.object({
  name: z.string(),
  bookingWindowDays: z.number().int(),
});

export const updateOrganizationBodySchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
export type UpdateOrganizationBody = z.infer<
  typeof updateOrganizationBodySchema
>;

z.globalRegistry.add(organizationSettingsSchema, {id: 'OrganizationSettings'});
z.globalRegistry.add(updateOrganizationBodySchema, {
  id: 'UpdateOrganizationBody',
});
