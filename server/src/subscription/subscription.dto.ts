import {z} from 'zod';

import {heldSchema} from '../booking/booking.dto.js';
import {resourceRefSchema} from '../resource/resource.dto.js';

export const subscriptionSchema = resourceRefSchema.extend({
  id: z.uuid(),
  date: z.iso.date(),
  start: z.string(),
  end: z.string(),
  endsAt: z.iso.datetime(),
  available: z.boolean(),
  started: z.boolean(),
  // What the apartment holds of the slot's kind, to offer booking it.
  held: heldSchema,
});

export const createSubscriptionBodySchema = z.object({
  date: z.iso.date(),
  start: z.string().min(1),
  resourceId: z.string().min(1),
});

export const subscriptionParamsSchema = z.object({
  id: z.uuid(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

z.globalRegistry.add(subscriptionSchema, {id: 'Subscription'});
z.globalRegistry.add(createSubscriptionBodySchema, {
  id: 'CreateSubscriptionBody',
});
