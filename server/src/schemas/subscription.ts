import {z} from 'zod';

export const subscriptionSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  slotId: z.string(),
  start: z.string(),
  end: z.string(),
  endsAt: z.iso.datetime(),
  available: z.boolean(),
});

export const createSubscriptionBodySchema = z.object({
  date: z.iso.date(),
  slotId: z.string().min(1),
});

export const subscriptionIdParamsSchema = z.object({
  id: z.uuid(),
});

z.globalRegistry.add(subscriptionSchema, {id: 'Subscription'});
z.globalRegistry.add(createSubscriptionBodySchema, {
  id: 'CreateSubscriptionBody',
});
