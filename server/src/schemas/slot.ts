import {z} from 'zod';

export const slotsQuerySchema = z.object({
  date: z.iso.date(),
});

export const bookingWindowSchema = z.object({
  today: z.iso.date(),
  from: z.iso.date(),
  to: z.iso.date(),
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
  }),
  z.object({
    ...slotTimes,
    status: z.literal('booked'),
  }),
  z.object({
    ...slotTimes,
    status: z.literal('mine'),
    bookingId: z.uuid(),
  }),
]);

z.globalRegistry.add(slotSchema, {id: 'Slot'});
z.globalRegistry.add(bookingWindowSchema, {id: 'BookingWindow'});
