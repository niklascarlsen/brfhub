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
  // With the kind's cap reached, the apartment's booking to give up for
  // this one.
  replaceBookingId: z.uuid().optional(),
});

// An apartment's booking that counts against its kind's cap.
export const heldBookingSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  start: z.string(),
  end: z.string(),
  resourceName: z.string(),
  started: z.boolean(),
  released: z.boolean(),
});

// What an apartment holds of a kind: how many it may hold at once, and
// the bookings that count, so a client can offer booking, swapping or
// neither.
export const heldSchema = z.object({
  max: z.number().int(),
  bookings: heldBookingSchema.array(),
});

export const bookingParamsSchema = z.object({
  id: z.uuid(),
});

export type Booking = z.infer<typeof bookingSchema>;
export type CreatedBooking = z.infer<typeof createdBookingSchema>;
export type HeldBooking = z.infer<typeof heldBookingSchema>;
export type Held = z.infer<typeof heldSchema>;

z.globalRegistry.add(bookingSchema, {id: 'Booking'});
z.globalRegistry.add(createdBookingSchema, {id: 'CreatedBooking'});
z.globalRegistry.add(createBookingBodySchema, {id: 'CreateBookingBody'});
z.globalRegistry.add(heldBookingSchema, {id: 'HeldBooking'});
z.globalRegistry.add(heldSchema, {id: 'Held'});
