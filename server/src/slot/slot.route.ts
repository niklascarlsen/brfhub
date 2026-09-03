import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {
  bookingWindowSchema,
  listSlotsQuerySchema,
  slotsSchema,
} from './slot.dto.js';
import {getBookingWindow, listSlots} from './slot.service.js';

export const slotRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/slots',
    {
      schema: {
        querystring: listSlotsQuerySchema,
        response: {
          200: slotsSchema,
          ...errorResponses,
        },
      },
    },
    async (request) =>
      listSlots({
        member: await getMember(request),
        date: request.query.date,
        resourceId: request.query.resourceId,
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
    async (request) => {
      const member = await getMember(request);
      return getBookingWindow(member.organizationId);
    },
  );
};
