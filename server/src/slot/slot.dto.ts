import {z} from 'zod';

import {heldSchema} from '../booking/booking.dto.js';

export const listSlotsQuerySchema = z.object({
  date: z.iso.date(),
  to: z.iso.date().optional(),
  resourceId: z.string().min(1),
});

export const listScheduleQuerySchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

const slotTimes = {
  date: z.iso.date(),
  start: z.string(),
  end: z.string(),
};

const slotSchema = z.discriminatedUnion('status', [
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

export const slotsSchema = z.object({
  slots: slotSchema.array(),
  held: heldSchema,
});

export const resourceScheduleSchema = slotsSchema.extend({
  resourceId: z.string(),
});

export const bookingWindowSchema = z.object({
  today: z.iso.date(),
  from: z.iso.date(),
  to: z.iso.date(),
});

export type Slot = z.infer<typeof slotSchema>;
export type Slots = z.infer<typeof slotsSchema>;
export type ResourceSchedule = z.infer<typeof resourceScheduleSchema>;
export type BookingWindow = z.infer<typeof bookingWindowSchema>;

z.globalRegistry.add(slotSchema, {id: 'Slot'});
z.globalRegistry.add(slotsSchema, {id: 'Slots'});
z.globalRegistry.add(resourceScheduleSchema, {id: 'ResourceSchedule'});
z.globalRegistry.add(bookingWindowSchema, {id: 'BookingWindow'});
