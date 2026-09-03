import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {resourceSchema} from './resource.dto.js';
import {listResources} from './resource.service.js';

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
};
