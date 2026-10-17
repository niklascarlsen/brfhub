import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {eventPageSchema, listEventsQuerySchema} from './event.dto.js';
import {listEvents} from './event.service.js';

export const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/events',
    {
      schema: {
        querystring: listEventsQuerySchema,
        response: {200: eventPageSchema, ...errorResponses},
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return listEvents(admin.organizationId, request.query);
    },
  );
};
