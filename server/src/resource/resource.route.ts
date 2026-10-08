import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {bookingRulesSchema, resourceSchema} from './resource.dto.js';
import {getBookingRules, listResources} from './resource.service.js';

export const resourceRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/resources',
    {
      schema: {
        response: {
          200: resourceSchema.array(),
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const member = await getMember(request);
      return listResources(member.organizationId);
    },
  );

  app.get(
    '/booking-rules',
    {
      schema: {
        response: {
          200: bookingRulesSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const member = await getMember(request);
      return getBookingRules(member.organizationId);
    },
  );
};
