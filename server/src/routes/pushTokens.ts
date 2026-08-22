import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {db} from '../db/index.js';
import {pushTokens} from '../db/schema.js';
import {errorSchema} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';

const pushTokenBodySchema = z.object({
  token: z.string().min(1),
});

z.globalRegistry.add(pushTokenBodySchema, {id: 'PushTokenBody'});

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
      await db
        .insert(pushTokens)
        .values({token: request.body.token, userId: getUserId(request)})
        .onConflictDoUpdate({
          target: pushTokens.token,
          set: {userId: getUserId(request)},
        });

      return reply.code(204).send();
    },
  );
};
