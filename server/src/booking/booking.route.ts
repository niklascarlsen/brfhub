import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorSchema, sendError} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {
  bookingParamsSchema,
  bookingSchema,
  createBookingBodySchema,
  createdBookingSchema,
} from './booking.dto.js';
import {
  createBooking,
  deleteBooking,
  listBookings,
} from './booking.service.js';

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
        log: request.log,
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
        params: bookingParamsSchema,
        response: {
          204: z.undefined(),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const outcome = await deleteBooking(
        request.params.id,
        getUserId(request),
        request.log,
      );

      if (outcome === 'NOT_FOUND') {
        return sendError(reply, 'NOT_FOUND', 'Booking not found');
      }

      if (outcome === 'FORBIDDEN') {
        return sendError(reply, 'FORBIDDEN', 'Not your booking');
      }

      return reply.code(204).send();
    },
  );
};
