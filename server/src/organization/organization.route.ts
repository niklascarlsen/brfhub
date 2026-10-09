import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {
  organizationSettingsSchema,
  updateOrganizationBodySchema,
} from './organization.dto.js';
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from './organization.service.js';

export const organizationRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/admin/organization',
    {schema: {response: {200: organizationSettingsSchema, ...errorResponses}}},
    async (request) => {
      const admin = await getAdmin(request);
      return getOrganizationSettings(admin.organizationId);
    },
  );

  app.patch(
    '/admin/organization',
    {
      schema: {
        body: updateOrganizationBodySchema,
        response: {200: organizationSettingsSchema, ...errorResponses},
      },
    },
    async (request) => {
      const admin = await getAdmin(request);
      return updateOrganizationSettings(admin.organizationId, request.body);
    },
  );
};
