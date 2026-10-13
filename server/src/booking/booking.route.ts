import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {
  bookingParamsSchema,
  bookingSchema,
  createBookingBodySchema,
  createdBookingSchema,
} from './booking.dto.js';
import {createBooking, deleteBooking, listBookings} from './booking.service.js';

export const bookingRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/bookings',
    {
      schema: {
        response: {
          200: bookingSchema.array(),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const member = await getMember(request);
      return listBookings(member);
    },
  );

  app.post(
    '/bookings',
    {
      schema: {
        body: createBookingBodySchema,
        response: {
          201: createdBookingSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const {date, start, resourceId, replaceExisting = false} = request.body;

      const booking = await createBooking({
        member: await getMember(request),
        date,
        start,
        resourceId,
        replaceExisting,
        notifier: app.notifier.forRequest(request.log),
      });

      return reply.code(201).send(booking);
    },
  );

  app.delete(
    '/bookings/:id',
    {
      schema: {
        params: bookingParamsSchema,
        response: {
          204: z.undefined(),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const member = await getMember(request);
      await deleteBooking(
        request.params.id,
        member,
        app.notifier.forRequest(request.log),
      );
      return reply.code(204).send();
    },
  );
};
