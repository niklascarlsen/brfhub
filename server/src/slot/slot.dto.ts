import {z} from 'zod';

export const listSlotsQuerySchema = z.object({
  date: z.iso.date(),
});

const slotTimes = {
  id: z.string(),
  start: z.string(),
  end: z.string(),
};

export const slotSchema = z.discriminatedUnion('status', [
  z.object({
    ...slotTimes,
    status: z.literal('available'),
    subscriptionId: z.uuid().nullable(),
  }),
  z.object({
    ...slotTimes,
    status: z.literal('walkin'),
  }),
  z.object({
    ...slotTimes,
    status: z.literal('booked'),
    started: z.boolean(),
    subscriptionId: z.uuid().nullable(),
  }),
  z.object({
    ...slotTimes,
    status: z.literal('mine'),
    bookingId: z.uuid(),
    started: z.boolean(),
  }),
]);

export const bookingWindowSchema = z.object({
  today: z.iso.date(),
  from: z.iso.date(),
  to: z.iso.date(),
});

export type Slot = z.infer<typeof slotSchema>;
export type BookingWindow = z.infer<typeof bookingWindowSchema>;

z.globalRegistry.add(slotSchema, {id: 'Slot'});
z.globalRegistry.add(bookingWindowSchema, {id: 'BookingWindow'});
