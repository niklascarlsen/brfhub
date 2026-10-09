import {z} from 'zod';

const resourceKindSchema = z.string();

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: resourceKindSchema,
  tags: z.array(z.string()),
});

export const resourceRefSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  resourceKind: resourceKindSchema,
});

const ruleSlotSchema = z.object({start: z.string(), end: z.string()});

export const bookingRulesSchema = z.object({
  kinds: z
    .object({
      id: resourceKindSchema,
      name: z.string(),
      maxActive: z.number().int(),
      resources: z
        .object({
          id: z.string(),
          name: z.string(),
          tags: z.array(z.string()),
          slots: ruleSlotSchema.array(),
          // Schedules set up to start on a later day, earliest first.
          changes: z
            .object({validFrom: z.iso.date(), slots: ruleSlotSchema.array()})
            .array(),
          closesFrom: z.iso.date().nullable(),
        })
        .array(),
    })
    .array(),
});

export type Resource = z.infer<typeof resourceSchema>;
export type BookingRules = z.infer<typeof bookingRulesSchema>;

z.globalRegistry.add(resourceSchema, {id: 'Resource'});
z.globalRegistry.add(bookingRulesSchema, {id: 'BookingRules'});
