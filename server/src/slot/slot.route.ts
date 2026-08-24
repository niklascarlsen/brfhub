import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
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
          ...errorResponses,
        },
      },
    },
    async (request) =>
      listSlots({
        userId: getUserId(request),
        date: request.query.date,
      }),
  );

  app.get(
    '/booking-window',
    {
      schema: {
        response: {
          200: bookingWindowSchema,
          ...errorResponses,
        },
      },
    },
    async () => getBookingWindow(),
  );
};
