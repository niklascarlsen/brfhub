import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {eq} from 'drizzle-orm';
import {z} from 'zod';

import {db} from '../db/index.js';
import {bookings} from '../db/schema.js';
import {errorSchema, sendError} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {
  bookingIdParamsSchema,
  bookingSchema,
  createBookingBodySchema,
  createdBookingSchema,
} from '../schemas/booking.js';
import {createBooking, listBookings} from '../services/bookings.js';

export const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bookings',
    {
      schema: {
        response: {
          200: bookingSchema.array(),
        },
      },
    },
    async (request) => listBookings(getUserId(request)),
  );

  app.post(
    '/bookings',
    {
      schema: {
        body: createBookingBodySchema,
        response: {
          201: createdBookingSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const {date, slotId, replaceExisting = false} = request.body;
      const result = await createBooking({
        userId: getUserId(request),
        date,
        slotId,
        replaceExisting,
      });

      if (!result.ok) {
        return sendError(
          reply,
          result.code,
          result.code === 'NOT_FOUND' ? 'Unknown time slot' : undefined,
        );
      }

      return reply.code(201).send(result.booking);
    },
  );

  app.delete(
    '/bookings/:id',
    {
      schema: {
        params: bookingIdParamsSchema,
        response: {
          204: z.undefined(),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const userId = getUserId(request);
      const {id} = request.params;

      const existing = await db
        .select({userId: bookings.userId})
        .from(bookings)
        .where(eq(bookings.id, id))
        .then((rows) => rows[0]);

      if (!existing) {
        return sendError(reply, 'NOT_FOUND', 'Booking not found');
      }

      if (existing.userId !== userId) {
        return sendError(reply, 'FORBIDDEN', 'Not your booking');
      }

      await db.delete(bookings).where(eq(bookings.id, id));
      return reply.code(204).send();
    },
  );
};
