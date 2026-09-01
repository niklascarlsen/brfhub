import {z} from 'zod';

import {RESOURCE_KINDS} from '../db/schema.js';

const resourceKindSchema = z.enum(RESOURCE_KINDS);

export const resourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: resourceKindSchema,
  hasDryer: z.boolean(),
});

export const resourceRefSchema = z.object({
  resourceId: z.string(),
  resourceName: z.string(),
  resourceKind: resourceKindSchema,
});

export type Resource = z.infer<typeof resourceSchema>;

z.globalRegistry.add(resourceSchema, {id: 'Resource'});
