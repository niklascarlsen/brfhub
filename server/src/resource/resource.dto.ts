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

export type Resource = z.infer<typeof resourceSchema>;

z.globalRegistry.add(resourceSchema, {id: 'Resource'});
