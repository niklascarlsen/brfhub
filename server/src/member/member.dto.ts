import {z} from 'zod';

export const meSchema = z.object({
  apartment: z.string(),
  organizationName: z.string(),
});

export type Me = z.infer<typeof meSchema>;

z.globalRegistry.add(meSchema, {id: 'Me'});
