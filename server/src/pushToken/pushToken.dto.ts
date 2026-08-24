import {z} from 'zod';

export const pushTokenBodySchema = z.object({
  token: z.string().min(1),
});

z.globalRegistry.add(pushTokenBodySchema, {id: 'PushTokenBody'});
