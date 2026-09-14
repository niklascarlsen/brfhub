import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
import {meSchema} from './member.dto.js';

export const memberRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/me',
    {
      schema: {
        response: {
          200: meSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const member = await getMember(request);
      return {apartment: member.label};
    },
  );
};
