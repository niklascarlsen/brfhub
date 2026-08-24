import {z} from 'zod';

export const bookingSchema = z.object({
  id: z.uuid(),
  date: z.iso.date(),
  slotId: z.string(),
  start: z.string(),
  end: z.string(),
  endsAt: z.iso.datetime(),
});

export const createdBookingSchema = bookingSchema.extend({
  replacedId: z.uuid().nullable(),
});

export const createBookingBodySchema = z.object({
  date: z.iso.date(),
  slotId: z.string().min(1),
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
