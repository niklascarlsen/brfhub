import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorSchema, sendError} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {
  createSubscriptionBodySchema,
  subscriptionIdParamsSchema,
  subscriptionSchema,
} from '../schemas/subscription.js';
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
} from '../services/subscriptions.js';

export const subscriptionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/subscriptions',
    {
      schema: {
        response: {
          200: subscriptionSchema.array(),
          500: errorSchema,
        },
      },
    },
    async (request) => listSubscriptions(getUserId(request)),
  );

  app.post(
    '/subscriptions',
    {
      schema: {
        body: createSubscriptionBodySchema,
        response: {
          201: subscriptionSchema,
          400: errorSchema,
          404: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createSubscription({
        userId: getUserId(request),
        ...request.body,
      });

      if (!result.ok) {
        return sendError(
          reply,
          result.code,
          result.code === 'NOT_FOUND' ? 'Unknown time slot' : undefined,
        );
      }

      return reply.code(201).send(result.subscription);
    },
  );

  app.delete(
    '/subscriptions/:id',
    {
      schema: {
        params: subscriptionIdParamsSchema,
        response: {
          204: z.undefined(),
          400: errorSchema,
          403: errorSchema,
          404: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const outcome = await deleteSubscription(
        request.params.id,
        getUserId(request),
      );

      if (outcome === 'NOT_FOUND') {
        return sendError(reply, 'NOT_FOUND', 'Subscription not found');
      }

      if (outcome === 'FORBIDDEN') {
        return sendError(reply, 'FORBIDDEN', 'Not your subscription');
      }

      return reply.code(204).send();
    },
  );
};
