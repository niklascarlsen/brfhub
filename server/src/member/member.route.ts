import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';
import {eq} from 'drizzle-orm';

import {db} from '../db/index.js';
import {organizations} from '../db/schema.js';
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
      const [organization] = await db
        .select({name: organizations.name})
        .from(organizations)
        .where(eq(organizations.id, member.organizationId));

      if (!organization) {
        throw new Error(`Unknown organization ${member.organizationId}`);
      }

      return {apartment: member.label, organizationName: organization.name};
    },
  );
};
