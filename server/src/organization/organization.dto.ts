import {z} from 'zod';

import {
  localeSchema,
  localizedTextSchema,
  optionalLocalizedInputSchema,
  organizationLocalesSchema,
} from '../lib/locale.js';
import {textSchema} from '../lib/text.js';

export const organizationSettingsSchema = z.object({
  name: z.string(),
  bookingWindowDays: z.number().int(),
  locales: localeSchema.array(),
  rulesText: localizedTextSchema,
});

// The rules are written in the languages the organization uses after the
// change, so turning a language on comes with its rules.
export const updateOrganizationBodySchema = z.object({
  name: textSchema(80).optional(),
  bookingWindowDays: z.number().int().min(1).max(365).optional(),
  locales: organizationLocalesSchema.optional(),
  rulesText: optionalLocalizedInputSchema(4000, {multiline: true}).optional(),
});

export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>;
export type UpdateOrganizationBody = z.infer<
  typeof updateOrganizationBodySchema
>;

z.globalRegistry.add(organizationSettingsSchema, {id: 'OrganizationSettings'});
z.globalRegistry.add(updateOrganizationBodySchema, {
  id: 'UpdateOrganizationBody',
});
