import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import {
  organizationSettingsSchema,
  updateOrganizationBodySchema,
  type UpdateOrganizationBody,
} from './organization.dto.js';
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from './organization.service.js';

// The parts of the settings a change touched, in the order the page shows
// them. The event names them by key, and each admin reads them in their own
// language.
const PARTS = [
  'name',
  'bookingWindowDays',
  'locales',
  'rulesText',
] as const satisfies readonly (keyof UpdateOrganizationBody)[];

function settingsChanged(body: UpdateOrganizationBody) {
  return PARTS.filter((part) => body[part] !== undefined).join(',');
}

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
      const settings = await updateOrganizationSettings(
        admin.organizationId,
        request.body,
      );
      // Which parts were sent, since each form saves its own.
      await logEvent(
        request,
        admin,
        'organization.update',
        settingsChanged(request.body),
      );
      return settings;
    },
  );
};
