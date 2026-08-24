import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorSchema, sendError} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {
  bookingWindowSchema,
  listSlotsQuerySchema,
  slotSchema,
} from './slot.dto.js';
import {getBookingWindow, listSlots} from './slot.service.js';

export const slotRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/slots',
    {
      schema: {
        querystring: listSlotsQuerySchema,
        response: {
          200: slotSchema.array(),
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await listSlots({
        userId: getUserId(request),
        date: request.query.date,
      });

      if (!result.ok) {
        return sendError(reply, result.code);
      }

      return result.slots;
    },
  );

  app.get(
    '/booking-window',
    {
      schema: {
        response: {
          200: bookingWindowSchema,
        },
      },
    },
    async () => getBookingWindow(),
  );
};
