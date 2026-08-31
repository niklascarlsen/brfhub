import {z} from 'zod';

export const subscriptionSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  slotId: z.string(),
  start: z.string(),
  end: z.string(),
  endsAt: z.iso.datetime(),
  available: z.boolean(),
  started: z.boolean(),
});

export const createSubscriptionBodySchema = z.object({
  date: z.iso.date(),
  slotId: z.string().min(1),
});

export const subscriptionParamsSchema = z.object({
  id: z.uuid(),
});

export type Subscription = z.infer<typeof subscriptionSchema>;

z.globalRegistry.add(subscriptionSchema, {id: 'Subscription'});
z.globalRegistry.add(createSubscriptionBodySchema, {
  id: 'CreateSubscriptionBody',
});
