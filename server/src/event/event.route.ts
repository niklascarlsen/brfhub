import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {adminEventSchema} from './event.dto.js';
import {listEvents} from './event.service.js';

export const eventRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/events',
    {
      schema: {
        response: {200: adminEventSchema.array(), ...errorResponses},
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return listEvents(admin.organizationId);
    },
  );
};
