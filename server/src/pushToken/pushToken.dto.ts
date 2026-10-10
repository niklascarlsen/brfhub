import {z} from 'zod';

import {localeSchema} from '../lib/locale.js';

// The device's language comes along, so its push is written in it.
export const pushTokenBodySchema = z.object({
  token: z.string().min(1),
  locale: localeSchema,
});

export const dropPushTokenBodySchema = pushTokenBodySchema.pick({token: true});

z.globalRegistry.add(pushTokenBodySchema, {id: 'PushTokenBody'});
z.globalRegistry.add(dropPushTokenBodySchema, {id: 'DropPushTokenBody'});
