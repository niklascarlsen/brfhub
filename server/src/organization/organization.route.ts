import type {FastifyPluginAsyncZod} from '@fastify/type-provider-zod';

import {logEvent} from '../event/event.service.js';
import {errorResponses} from '../lib/errors.js';
import {getAdmin} from '../lib/user.js';
import type {Locale} from '../lib/locale.js';
import {
  organizationSettingsSchema,
  updateOrganizationBodySchema,
  type UpdateOrganizationBody,
} from './organization.dto.js';
import {
  getOrganizationSettings,
  updateOrganizationSettings,
} from './organization.service.js';

// The parts of the settings a change touched, named for the event log.
const PARTS: Record<Locale, Record<keyof UpdateOrganizationBody, string>> = {
  sv: {
    name: 'namnet',
    bookingWindowDays: 'bokningsfönstret',
    locales: 'språken',
    rulesText: 'ordningsreglerna',
  },
  en: {
    name: 'the name',
    bookingWindowDays: 'the booking window',
    locales: 'the languages',
    rulesText: 'the rules',
  },
};

function settingsChanged(body: UpdateOrganizationBody, locale: Locale) {
  return (Object.keys(PARTS[locale]) as (keyof UpdateOrganizationBody)[])
    .filter((part) => body[part] !== undefined)
    .map((part) => PARTS[locale][part])
    .join(', ');
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
        settingsChanged(request.body, admin.locale),
      );
      return settings;
    },
  );
};
