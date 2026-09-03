import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorResponses} from '../lib/errors.js';
import {getMember} from '../lib/user.js';
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
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const member = await getMember(request);
      await savePushToken(member.id, request.body.token);
      return reply.code(204).send();
    },
  );
};
