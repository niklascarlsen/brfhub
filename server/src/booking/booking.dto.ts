import {z} from 'zod';

import {resourceRefSchema} from '../resource/resource.dto.js';

export const bookingSchema = resourceRefSchema.extend({
  id: z.uuid(),
  date: z.iso.date(),
  start: z.string(),
  end: z.string(),
  endsAt: z.iso.datetime(),
  started: z.boolean(),
  released: z.boolean(),
});

export const createdBookingSchema = bookingSchema.extend({
  replacedId: z.uuid().nullable(),
});

export const createBookingBodySchema = z.object({
  date: z.iso.date(),
  start: z.string().min(1),
  resourceId: z.string().min(1),
  replaceExisting: z.boolean().optional(),
});

export const bookingParamsSchema = z.object({
  id: z.uuid(),
});

export type Booking = z.infer<typeof bookingSchema>;
export type CreatedBooking = z.infer<typeof createdBookingSchema>;

z.globalRegistry.add(bookingSchema, {id: 'Booking'});
z.globalRegistry.add(createdBookingSchema, {id: 'CreatedBooking'});
z.globalRegistry.add(createBookingBodySchema, {id: 'CreateBookingBody'});
