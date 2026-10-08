import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {
  bookingWindowSchema,
  listScheduleQuerySchema,
  listSlotsQuerySchema,
  resourceScheduleSchema,
  slotsSchema,
} from './slot.dto.js';
import {getBookingWindow, listSchedule, listSlots} from './slot.service.js';

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
        to: request.query.to,
        resourceId: request.query.resourceId,
      }),
  );

  // Every resource over a range in one request, for a client that shows the
  // whole booking window at once.
  app.get(
    '/schedule',
    {
      schema: {
        querystring: listScheduleQuerySchema,
        response: {
          200: resourceScheduleSchema.array(),
          ...errorResponses,
        },
      },
    },
    async (request) =>
      listSchedule({
        member: await getMember(request),
        from: request.query.from,
        to: request.query.to,
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
