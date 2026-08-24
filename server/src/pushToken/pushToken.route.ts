import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorSchema} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {pushTokenBodySchema} from './pushToken.dto.js';
import {savePushToken} from './pushToken.service.js';

export const pushTokenRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/push-tokens',
    {
      schema: {
        body: pushTokenBodySchema,
        response: {
          204: z.undefined(),
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      await savePushToken(getUserId(request), request.body.token);
      return reply.code(204).send();
    },
  );
};
