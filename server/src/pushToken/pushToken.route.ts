import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {z} from 'zod';

import {errorResponses} from '../lib/errors.js';
import {getMember, getSignedIn} from '../lib/user.js';
import {pushTokenBodySchema} from './pushToken.dto.js';
import {
  removeMemberPushToken,
  removePushTokens,
  savePushToken,
} from './pushToken.service.js';

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

  app.delete(
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
      const signedIn = await getSignedIn(request);

      // The admin signs in on a phone an apartment used before: holding the
      // token is enough to stop the apartment's push reaching this device.
      if (signedIn.role === 'admin') {
        await removePushTokens([request.body.token]);
      } else {
        await removeMemberPushToken(signedIn.member.id, request.body.token);
      }

      return reply.code(204).send();
    },
  );
};
