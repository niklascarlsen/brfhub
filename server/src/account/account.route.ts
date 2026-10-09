import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getSignedIn} from '../lib/user.js';
import {accountSchema} from './account.dto.js';
import {getAccount} from './account.service.js';

export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/account',
    {
      schema: {
        response: {
          200: accountSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => getAccount(await getSignedIn(request)),
  );
};
