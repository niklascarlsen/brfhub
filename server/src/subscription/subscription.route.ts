import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorResponses} from '../lib/errors.js';
import {getUserId} from '../lib/user.js';
import {
  createSubscriptionBodySchema,
  subscriptionParamsSchema,
  subscriptionSchema,
} from './subscription.dto.js';
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
} from './subscription.service.js';

export const subscriptionRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/subscriptions',
    {
      schema: {
        response: {
          200: subscriptionSchema.array(),
          ...errorResponses,
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
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const subscription = await createSubscription({
        userId: getUserId(request),
        ...request.body,
      });

      return reply.code(201).send(subscription);
    },
  );

  app.delete(
    '/subscriptions/:id',
    {
      schema: {
        params: subscriptionParamsSchema,
        response: {
          204: z.undefined(),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      await deleteSubscription(request.params.id, getUserId(request));
      return reply.code(204).send();
    },
  );
};
